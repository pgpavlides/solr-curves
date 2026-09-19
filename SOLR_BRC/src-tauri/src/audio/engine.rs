//! The real-time mixer.
//!
//! Rules the audio callback obeys, because breaking any of them causes audible
//! dropouts on a live mic bus:
//!   * no allocation, no locks, no I/O, no logging
//!   * finished clips are handed back to a janitor thread rather than dropped
//!     here - dropping the last Arc would free memory on the audio thread
//!
//! A cpal Stream is not Send on Windows, so the stream lives on a dedicated
//! thread and is driven entirely through a lock-free queue.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, StreamTrait};
use parking_lot::Mutex;

use super::devices;
use super::resample::Prepared;

const MAX_VOICES: usize = 48;
const CMD_CAPACITY: usize = 256;

pub enum Cmd {
    Play { clip: Arc<Prepared>, gain: f32 },
    StopAll,
    SetMaster(f32),
    SetKeepAlive(bool),
}

/// Level of the keep-alive signal, about -45 dBFS.
///
/// A voice chat gate needs sustained input before it opens, and it opens too
/// slowly for a one-second clip: the clip is over before anyone hears it. A
/// continuous floor holds the gate open so every clip transmits from its first
/// sample. Loud enough to clear a typical activation threshold, quiet enough to
/// be a faint hiss. Only ever applied to the cable, never the monitor.
const KEEPALIVE_LEVEL: f32 = 0.0056;

struct Voice {
    clip: Arc<Prepared>,
    pos: usize,
    gain: f32,
}

/// xorshift32: a few instructions, no allocation, no locks - safe to call from
/// the audio callback, and random enough for a noise floor.
#[inline]
fn next_noise(state: &mut u32) -> f32 {
    let mut x = *state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *state = x;
    // Map to -1.0..1.0
    (x as f32 / u32::MAX as f32) * 2.0 - 1.0
}

/// Handle to a running engine, shared through Tauri state.
pub struct Engine {
    cmd: Mutex<rtrb::Producer<Cmd>>,
    shutdown: Arc<AtomicBool>,
    pub rate: u32,
    pub channels: usize,
    pub device_name: String,
}

impl Engine {
    /// Start an output stream on `device_key` (a DeviceId string, or a name).
    pub fn start(device_key: Option<&str>) -> Result<Self> {
        let device = devices::output_by_key(device_key)?;
        let name = device
            .description()
            .map(|d| d.name().to_string())
            .unwrap_or_else(|_| "<unknown>".into());
        let supported = device.default_output_config()?;
        let rate = supported.sample_rate();
        let channels = supported.channels() as usize;
        let config: cpal::StreamConfig = supported.config();

        let (cmd_tx, mut cmd_rx) = rtrb::RingBuffer::<Cmd>::new(CMD_CAPACITY);
        let (gc_tx, gc_rx) = rtrb::RingBuffer::<Arc<Prepared>>::new(MAX_VOICES * 4);
        let mut gc_tx = gc_tx;

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_thread = shutdown.clone();
        // Report stream-build success or failure back to the caller.
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

        std::thread::Builder::new()
            .name("solr-audio".into())
            .spawn(move || {
                let mut voices: Vec<Option<Voice>> = Vec::with_capacity(MAX_VOICES);
                voices.resize_with(MAX_VOICES, || None);
                let mut master = 1.0f32;
                let mut keepalive = false;
                let mut rng: u32 = 0x9E3779B9;

                let built = device.build_output_stream(
                    config,
                    move |out: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        // 1. Apply queued commands.
                        while let Ok(cmd) = cmd_rx.pop() {
                            match cmd {
                                Cmd::Play { clip, gain } => {
                                    // Steal the furthest-advanced voice if every
                                    // slot is busy; a soundboard should never
                                    // refuse a trigger.
                                    let slot = voices
                                        .iter()
                                        .position(|v| v.is_none())
                                        .or_else(|| {
                                            voices
                                                .iter()
                                                .enumerate()
                                                .max_by_key(|(_, v)| {
                                                    v.as_ref().map(|x| x.pos).unwrap_or(0)
                                                })
                                                .map(|(i, _)| i)
                                        })
                                        .unwrap_or(0);
                                    if let Some(old) = voices[slot].take() {
                                        let _ = gc_tx.push(old.clip);
                                    }
                                    voices[slot] = Some(Voice { clip, pos: 0, gain });
                                }
                                Cmd::StopAll => {
                                    for v in voices.iter_mut() {
                                        if let Some(old) = v.take() {
                                            let _ = gc_tx.push(old.clip);
                                        }
                                    }
                                }
                                Cmd::SetMaster(g) => master = g,
                                Cmd::SetKeepAlive(on) => keepalive = on,
                            }
                        }

                        // 2. Mix.
                        for s in out.iter_mut() {
                            *s = 0.0;
                        }
                        for slot in voices.iter_mut() {
                            let done = {
                                let Some(v) = slot.as_mut() else { continue };
                                let src = &v.clip.samples;
                                let n = out.len().min(src.len().saturating_sub(v.pos));
                                for i in 0..n {
                                    out[i] += src[v.pos + i] * v.gain;
                                }
                                v.pos += n;
                                v.pos >= src.len()
                            };
                            if done {
                                if let Some(old) = slot.take() {
                                    // Hand the Arc off; never drop it here.
                                    let _ = gc_tx.push(old.clip);
                                }
                            }
                        }

                        // 3. Master gain, then a hard clamp. This bus feeds a mic
                        //    input, so overshoot would arrive as digital crackle.
                        for s in out.iter_mut() {
                            *s = (*s * master).clamp(-1.0, 1.0);
                        }

                        // 4. Keep-alive floor, added after the clamp so it is
                        //    never scaled away by a low master gain - its whole
                        //    job is to be continuously present.
                        if keepalive {
                            for s in out.iter_mut() {
                                *s += next_noise(&mut rng) * KEEPALIVE_LEVEL;
                            }
                        }
                    },
                    |err| eprintln!("audio stream error: {err}"),
                    None,
                );

                match built {
                    Ok(stream) => {
                        if let Err(e) = stream.play() {
                            let _ = ready_tx.send(Err(e.to_string()));
                            return;
                        }
                        let _ = ready_tx.send(Ok(()));
                        // Hold the stream alive; it stops when this thread exits.
                        while !shutdown_thread.load(Ordering::Relaxed) {
                            std::thread::sleep(Duration::from_millis(100));
                        }
                    }
                    Err(e) => {
                        let _ = ready_tx.send(Err(e.to_string()));
                    }
                }
            })
            .map_err(|e| anyhow!("could not start audio thread: {e}"))?;

        // Janitor: frees clips the audio thread finished with.
        let shutdown_gc = shutdown.clone();
        let mut gc_rx = gc_rx;
        std::thread::Builder::new()
            .name("solr-audio-gc".into())
            .spawn(move || {
                while !shutdown_gc.load(Ordering::Relaxed) {
                    while let Ok(clip) = gc_rx.pop() {
                        drop(clip);
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
            })
            .ok();

        match ready_rx.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(anyhow!("could not open \"{name}\": {e}")),
            Err(_) => return Err(anyhow!("timed out opening \"{name}\"")),
        }

        Ok(Engine {
            cmd: Mutex::new(cmd_tx),
            shutdown,
            rate,
            channels,
            device_name: name,
        })
    }

    fn send(&self, cmd: Cmd) -> Result<()> {
        self.cmd
            .lock()
            .push(cmd)
            .map_err(|_| anyhow!("audio command queue full"))
    }

    pub fn play(&self, clip: Arc<Prepared>, gain: f32) -> Result<()> {
        self.send(Cmd::Play { clip, gain })
    }

    pub fn stop_all(&self) -> Result<()> {
        self.send(Cmd::StopAll)
    }

    pub fn set_master(&self, gain: f32) -> Result<()> {
        self.send(Cmd::SetMaster(gain.clamp(0.0, 2.0)))
    }

    /// Hold a downstream voice-activity gate open. Cable only.
    pub fn set_keep_alive(&self, on: bool) -> Result<()> {
        self.send(Cmd::SetKeepAlive(on))
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }
}
