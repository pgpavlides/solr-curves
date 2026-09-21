//! Horn Music: songs played on the helicopter's horn, into voice chat.
//!
//! The instrument is one recording of the horn. "Record" captures what the PC
//! is playing (WASAPI loopback on the default output) for a few seconds while
//! you honk in WARDOGS; the recording is folded to mono, trimmed to the honk,
//! normalised, and its pitch found - that note is the horn's own.
//!
//! A MIDI file becomes a list of notes (tempo changes honoured; channel 10,
//! the drums, marked so it can be left out). Rendering plays every note on the
//! horn: the recording resampled by 2^(semitones / 12), its middle looped
//! (with a crossfade) for notes longer than the honk, a short fade in and out.
//! The whole song is mixed offline into one WAV, which sound.rs then plays
//! like a pad - into the cable with the talk key held, and to you.
//!
//! Files, all in C:\SolR\horn: horn.wav (the instrument), horn.json (its
//! note), song.wav (the last render).

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

fn folder() -> PathBuf {
    let d = crate::dir().join("horn");
    let _ = std::fs::create_dir_all(&d);
    d
}
fn horn_path() -> PathBuf {
    folder().join("horn.wav")
}
fn song_path() -> PathBuf {
    folder().join("song.wav")
}
fn settings_path() -> PathBuf {
    folder().join("horn.json")
}

#[derive(Serialize, Deserialize, Default, Clone, Copy)]
struct Settings {
    /// the MIDI note the horn sounds at (what a note of this pitch plays unshifted)
    base: f32,
    /// what the pitch finder heard, kept for reference
    detected: Option<f32>,
}

fn settings() -> Settings {
    std::fs::read_to_string(settings_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Settings { base: 60.0, detected: None })
}
fn save_settings(s: Settings) {
    let _ = std::fs::write(settings_path(), serde_json::to_string_pretty(&s).unwrap_or_default());
}

// ---------------------------------------------------------------- the horn

/// The instrument as the page shows it.
#[derive(Serialize)]
pub struct HornInfo {
    pub has: bool,
    pub seconds: f32,
    pub base: f32,
    pub detected: Option<f32>,
    /// the waveform, 240 bars of peak level 0..1
    pub peaks: Vec<f32>,
}

/// The horn recording, mono, and its rate.
fn load_horn() -> Option<(Vec<f32>, u32)> {
    let clip = crate::audio::decode::decode_file(&horn_path()).ok()?;
    Some((to_mono(&clip.samples, clip.channels), clip.rate))
}

pub fn info() -> HornInfo {
    let s = settings();
    match load_horn() {
        None => HornInfo { has: false, seconds: 0.0, base: s.base, detected: s.detected, peaks: vec![] },
        Some((m, rate)) => HornInfo {
            has: true,
            seconds: m.len() as f32 / rate.max(1) as f32,
            base: s.base,
            detected: s.detected,
            peaks: peaks(&m, 240),
        },
    }
}

pub fn set_base(base: f32) -> HornInfo {
    let mut s = settings();
    s.base = base.clamp(12.0, 120.0);
    save_settings(s);
    info()
}

fn to_mono(samples: &[f32], channels: usize) -> Vec<f32> {
    let ch = channels.max(1);
    samples.chunks(ch).map(|f| f.iter().sum::<f32>() / ch as f32).collect()
}

fn peaks(m: &[f32], bars: usize) -> Vec<f32> {
    if m.is_empty() {
        return vec![];
    }
    let per = (m.len() as f32 / bars as f32).max(1.0);
    (0..bars)
        .map(|i| {
            let a = (i as f32 * per) as usize;
            let b = (((i + 1) as f32 * per) as usize).min(m.len()).max(a + 1).min(m.len());
            m[a.min(m.len() - 1)..b].iter().fold(0.0f32, |p, s| p.max(s.abs()))
        })
        .collect()
}

/// Keep only the honk: from just before the sound starts to a little after it
/// stops, judged against the loudest point.
fn trim(m: &[f32], rate: u32) -> Vec<f32> {
    let peak = m.iter().fold(0.0f32, |p, s| p.max(s.abs()));
    let thr = (peak * 0.08).max(0.01);
    let first = m.iter().position(|s| s.abs() > thr).unwrap_or(0);
    let last = m.iter().rposition(|s| s.abs() > thr).unwrap_or(m.len().saturating_sub(1));
    let a = first.saturating_sub((rate as f32 * 0.01) as usize);
    let b = (last + (rate as f32 * 0.06) as usize).min(m.len());
    m[a..b.max(a)].to_vec()
}

fn normalise(m: &mut [f32], to: f32) {
    let peak = m.iter().fold(0.0f32, |p, s| p.max(s.abs()));
    if peak > 1e-6 {
        let k = to / peak;
        m.iter_mut().for_each(|s| *s *= k);
    }
}

/// The horn's pitch, as a (fractional) MIDI note: YIN over a steady stretch
/// from the middle of the honk, 50 Hz..1 kHz.
fn detect_pitch(m: &[f32], rate: u32) -> Option<f32> {
    let win = ((rate as f32 * 0.08) as usize).min(m.len() / 2);
    let start = (m.len() / 3).min(m.len().saturating_sub(win * 2));
    if win < 64 || start + win * 2 > m.len() {
        return None;
    }
    let x = &m[start..start + win * 2];
    let (min_lag, max_lag) = ((rate / 1000).max(2) as usize, ((rate / 50) as usize).min(win - 1));
    let mut d = vec![0.0f32; max_lag + 1];
    for lag in 1..=max_lag {
        d[lag] = (0..win).map(|i| (x[i] - x[i + lag]).powi(2)).sum();
    }
    // cumulative mean normalised difference
    let mut cmnd = vec![1.0f32; max_lag + 1];
    let mut running = 0.0;
    for lag in 1..=max_lag {
        running += d[lag];
        cmnd[lag] = if running > 0.0 { d[lag] * lag as f32 / running } else { 1.0 };
    }
    let mut best = None;
    for lag in min_lag..max_lag {
        if cmnd[lag] < 0.15 {
            let mut l = lag;
            while l + 1 < max_lag && cmnd[l + 1] < cmnd[l] {
                l += 1;
            }
            best = Some(l);
            break;
        }
    }
    let lag = best.unwrap_or_else(|| (min_lag..max_lag).min_by(|&a, &b| cmnd[a].total_cmp(&cmnd[b])).unwrap_or(min_lag));
    // parabolic interpolation around the dip
    let (a, b, c) = (cmnd[lag - 1], cmnd[lag], cmnd[lag + 1]);
    let den = a - 2.0 * b + c;
    let shift = if den.abs() > 1e-9 { 0.5 * (a - c) / den } else { 0.0 };
    let f = rate as f32 / (lag as f32 + shift);
    (f.is_finite() && f > 20.0).then(|| 69.0 + 12.0 * (f / 440.0).log2())
}

/// A raw recording (or a picked file) becomes the instrument.
fn make_instrument(mono: Vec<f32>, rate: u32) -> Result<HornInfo, String> {
    let mut m = trim(&mono, rate);
    if m.len() < (rate as f32 * 0.05) as usize {
        return Err("Nothing loud enough was heard - honk while it records (and keep other sound down).".into());
    }
    normalise(&mut m, 0.9);
    write_wav(&horn_path(), &m, rate)?;
    let detected = detect_pitch(&m, rate);
    // the exact pitch, not the nearest note: a horn between two notes still plays in tune
    save_settings(Settings { base: detected.unwrap_or(60.0), detected });
    Ok(info())
}

/// Record what the PC plays for `seconds` - honk in the game meanwhile.
pub fn record(seconds: f32) -> Result<HornInfo, String> {
    let host = cpal::default_host();
    let dev = host.default_output_device().ok_or("No sound output device to record from")?;
    let supported = dev.default_output_config().map_err(|e| e.to_string())?;
    let rate = supported.sample_rate();
    let channels = supported.channels() as usize;
    let got: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let sink = got.clone();
    let err = |e: cpal::Error| eprintln!("horn recording: {e}");
    // an output device opened for input is WASAPI loopback: what it plays
    let stream = match supported.sample_format() {
        cpal::SampleFormat::F32 => dev.build_input_stream::<f32, _, _>(
            supported.config(),
            move |d: &[f32], _: &cpal::InputCallbackInfo| sink.lock().unwrap().extend_from_slice(d),
            err,
            None,
        ),
        cpal::SampleFormat::I16 => dev.build_input_stream::<i16, _, _>(
            supported.config(),
            move |d: &[i16], _: &cpal::InputCallbackInfo| sink.lock().unwrap().extend(d.iter().map(|s| *s as f32 / 32768.0)),
            err,
            None,
        ),
        f => return Err(format!("Can't record this device's format ({f:?})")),
    }
    .map_err(|e| format!("Couldn't start recording: {e}"))?;
    stream.play().map_err(|e| e.to_string())?;
    std::thread::sleep(Duration::from_secs_f32(seconds.clamp(1.0, 10.0)));
    drop(stream);
    let raw = std::mem::take(&mut *got.lock().unwrap());
    let mono = to_mono(&raw, channels);
    let _ = write_wav(&folder().join("horn_raw.wav"), &mono, rate);
    make_instrument(mono, rate)
}

/// Use a sound file instead of a recording.
pub fn load_file(bytes: Vec<u8>, ext: String) -> Result<HornInfo, String> {
    let ext: String = ext.chars().filter(|c| c.is_ascii_alphanumeric()).take(5).collect();
    let tmp = folder().join(format!("horn_pick.{ext}"));
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    let clip = crate::audio::decode::decode_file(&tmp).map_err(|e| format!("Can't read that file: {e:#}"))?;
    let _ = std::fs::remove_file(&tmp);
    make_instrument(to_mono(&clip.samples, clip.channels), clip.rate)
}

// ---------------------------------------------------------------- MIDI

#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct Note {
    /// start and length, seconds
    pub t: f32,
    pub d: f32,
    pub key: u8,
    pub vel: u8,
    pub track: usize,
}

#[derive(Serialize)]
pub struct TrackInfo {
    pub index: usize,
    pub name: String,
    pub notes: usize,
    pub low: u8,
    pub high: u8,
    /// every note on channel 10: a drum kit, not a tune
    pub drums: bool,
}

#[derive(Serialize)]
pub struct Song {
    pub tracks: Vec<TrackInfo>,
    pub notes: Vec<Note>,
    pub seconds: f32,
}

pub fn parse_midi(bytes: &[u8]) -> Result<Song, String> {
    use midly::{MetaMessage, MidiMessage, Smf, Timing, TrackEventKind};
    let smf = Smf::parse(bytes).map_err(|e| format!("Not a MIDI file I can read: {e}"))?;

    // every tempo change, from any track, by absolute tick
    let mut tempos: Vec<(u64, f64)> = vec![(0, 500_000.0)];
    for track in &smf.tracks {
        let mut tick = 0u64;
        for ev in track {
            tick += ev.delta.as_int() as u64;
            if let TrackEventKind::Meta(MetaMessage::Tempo(us)) = ev.kind {
                tempos.push((tick, us.as_int() as f64));
            }
        }
    }
    tempos.sort_by_key(|t| t.0);
    let seconds_at = |tick: u64| -> f64 {
        match smf.header.timing {
            Timing::Timecode(fps, sub) => tick as f64 / (fps.as_f32() as f64 * sub.max(1) as f64),
            Timing::Metrical(tpb) => {
                let tpb = tpb.as_int().max(1) as f64;
                let (mut secs, mut last_tick, mut us) = (0.0, 0u64, 500_000.0);
                for &(at, tempo) in &tempos {
                    if at >= tick {
                        break;
                    }
                    secs += (at - last_tick) as f64 * us / tpb / 1e6;
                    last_tick = at;
                    us = tempo;
                }
                secs + (tick - last_tick) as f64 * us / tpb / 1e6
            }
        }
    };

    let mut notes = vec![];
    let mut tracks = vec![];
    for (ti, track) in smf.tracks.iter().enumerate() {
        let mut tick = 0u64;
        let mut name = String::new();
        let mut open: std::collections::HashMap<(u8, u8), (u64, u8)> = Default::default();
        let (mut count, mut low, mut high, mut drum_notes) = (0usize, 127u8, 0u8, 0usize);
        for ev in track {
            tick += ev.delta.as_int() as u64;
            match ev.kind {
                TrackEventKind::Meta(MetaMessage::TrackName(n)) if name.is_empty() => {
                    name = String::from_utf8_lossy(n).trim().to_string();
                }
                TrackEventKind::Midi { channel, message } => {
                    let ch = channel.as_int();
                    let (key, on, vel) = match message {
                        MidiMessage::NoteOn { key, vel } => (key.as_int(), vel.as_int() > 0, vel.as_int()),
                        MidiMessage::NoteOff { key, .. } => (key.as_int(), false, 0),
                        _ => continue,
                    };
                    // a new note-on also ends one still sounding on the same key
                    if let Some((start, v)) = open.remove(&(ch, key)) {
                        let t = seconds_at(start);
                        notes.push(Note { t: t as f32, d: (seconds_at(tick) - t) as f32, key, vel: v, track: ti });
                        count += 1;
                        low = low.min(key);
                        high = high.max(key);
                        if ch == 9 {
                            drum_notes += 1;
                        }
                    }
                    if on {
                        open.insert((ch, key), (tick, vel));
                    }
                }
                _ => {}
            }
        }
        if count > 0 {
            tracks.push(TrackInfo {
                index: ti,
                name: if name.is_empty() { format!("Track {}", ti + 1) } else { name },
                notes: count,
                low,
                high,
                drums: drum_notes * 2 > count,
            });
        }
    }
    notes.sort_by(|a, b| a.t.total_cmp(&b.t));
    let seconds = notes.iter().fold(0.0f32, |m, n| m.max(n.t + n.d));
    if notes.is_empty() {
        return Err("That MIDI file has no notes in it.".into());
    }
    Ok(Song { tracks, notes, seconds })
}

// ---------------------------------------------------------------- rendering

#[derive(Serialize)]
pub struct Rendered {
    pub seconds: f32,
    pub notes: usize,
}

/// Linear interpolation into the recording.
fn at(s: &[f32], p: f64) -> f32 {
    let i = p.floor() as usize;
    if i + 1 >= s.len() {
        return s.last().copied().unwrap_or(0.0);
    }
    let f = (p - i as f64) as f32;
    s[i] * (1.0 - f) + s[i + 1] * f
}

/// Every note on the horn, mixed into one track.
pub fn render_notes(horn: &[f32], rate: u32, base: f32, notes: &[Note], transpose: i32, speed: f32) -> Vec<f32> {
    let r = rate as f64;
    let speed = speed.clamp(0.25, 4.0) as f64;
    let n = horn.len();
    // the steady middle of the honk loops for notes longer than the recording
    let (ls, le) = ((n as f64 * 0.3), (n as f64 * 0.8));
    let loop_len = le - ls;
    let can_loop = loop_len > r * 0.05;
    let xf = (r * 0.02).min(loop_len / 4.0);
    let release = 0.05;
    let attack = (r * 0.005).max(1.0);

    let end = notes.iter().fold(0.0f64, |m, x| m.max((x.t as f64 + (x.d as f64).max(0.08)) / speed)) + release + 0.2;
    let mut out = vec![0.0f32; ((end.min(600.0)) * r) as usize + 1];
    for note in notes {
        let start = (note.t as f64 / speed * r) as usize;
        if start >= out.len() {
            continue;
        }
        let held = ((note.d as f64).max(0.08) / speed * r) as usize;
        let total = held + (release * r) as usize;
        let ratio = 2f64.powf((note.key as f64 + transpose as f64 - base as f64) / 12.0);
        let gain = 0.35 + 0.65 * note.vel as f32 / 127.0;
        let mut p = 0.0f64;
        for i in 0..total {
            let o = start + i;
            if o >= out.len() || p >= (n - 1) as f64 {
                break;
            }
            let mut v = at(horn, p);
            let holding = i < held;
            if holding && can_loop && p > le - xf {
                let w = ((p - (le - xf)) / xf).clamp(0.0, 1.0) as f32;
                v = v * (1.0 - w) + at(horn, p - loop_len) * w;
            }
            let env_in = (i as f64 / attack).min(1.0) as f32;
            let env_out = if holding { 1.0 } else { 1.0 - (i - held) as f32 / (release * r) as f32 };
            out[o] += v * gain * env_in * env_out.max(0.0);
            p += ratio;
            if holding && can_loop && p >= le {
                p -= loop_len;
            }
        }
    }
    normalise(&mut out, 0.89);
    out
}

pub fn render(notes: Vec<Note>, transpose: i32, speed: f32) -> Result<Rendered, String> {
    let (horn, rate) = load_horn().ok_or("Record the horn first.")?;
    if notes.is_empty() {
        return Err("No notes to play - pick at least one track.".into());
    }
    let base = settings().base;
    let out = render_notes(&horn, rate, base, &notes, transpose, speed);
    write_wav(&song_path(), &out, rate)?;
    Ok(Rendered { seconds: out.len() as f32 / rate as f32, notes: notes.len() })
}

/// The last render: into the game (talk key held), or to you only.
pub fn play(game: bool) -> Result<(), String> {
    let p = song_path();
    if !p.exists() {
        return Err("Nothing rendered yet.".into());
    }
    crate::sound::play_file(p, game);
    Ok(())
}

/// Just the horn, on you only.
pub fn hear_horn() -> Result<(), String> {
    let p = horn_path();
    if !p.exists() {
        return Err("Record the horn first.".into());
    }
    crate::sound::play_file(p, false);
    Ok(())
}

// ---------------------------------------------------------------- WAV

fn write_wav(path: &std::path::Path, mono: &[f32], rate: u32) -> Result<(), String> {
    let data_len = (mono.len() * 2) as u32;
    let mut b = Vec::with_capacity(44 + data_len as usize);
    b.extend_from_slice(b"RIFF");
    b.extend_from_slice(&(36 + data_len).to_le_bytes());
    b.extend_from_slice(b"WAVEfmt ");
    b.extend_from_slice(&16u32.to_le_bytes());
    b.extend_from_slice(&1u16.to_le_bytes()); // PCM
    b.extend_from_slice(&1u16.to_le_bytes()); // mono
    b.extend_from_slice(&rate.to_le_bytes());
    b.extend_from_slice(&(rate * 2).to_le_bytes());
    b.extend_from_slice(&2u16.to_le_bytes());
    b.extend_from_slice(&16u16.to_le_bytes());
    b.extend_from_slice(b"data");
    b.extend_from_slice(&data_len.to_le_bytes());
    for s in mono {
        b.extend_from_slice(&((s.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
    }
    std::fs::write(path, b).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(freq: f32, rate: u32, secs: f32) -> Vec<f32> {
        (0..(rate as f32 * secs) as usize).map(|i| (i as f32 / rate as f32 * freq * std::f32::consts::TAU).sin() * 0.5).collect()
    }

    #[test]
    fn finds_the_pitch_of_a_tone() {
        // A3 = 220 Hz = MIDI 57
        let n = detect_pitch(&tone(220.0, 48000, 1.0), 48000).unwrap();
        assert!((n - 57.0).abs() < 0.1, "{n}");
        let n = detect_pitch(&tone(440.0, 44100, 1.0), 44100).unwrap();
        assert!((n - 69.0).abs() < 0.1, "{n}");
    }

    #[test]
    fn trims_the_silence_around_a_honk() {
        let rate = 48000;
        let mut m = vec![0.0; rate as usize];
        m.extend(tone(300.0, rate, 0.5));
        m.extend(vec![0.0; rate as usize]);
        let t = trim(&m, rate);
        let secs = t.len() as f32 / rate as f32;
        assert!(secs > 0.5 && secs < 0.6, "{secs}");
    }

    #[test]
    fn an_octave_up_plays_twice_the_pitch() {
        let rate = 48000;
        let horn = tone(200.0, rate, 1.0); // base: whatever MIDI 200 Hz is
        let base = 69.0 + 12.0 * (200.0f32 / 440.0).log2();
        let notes = [Note { t: 0.0, d: 0.5, key: (base.round() as u8) + 12, vel: 127, track: 0 }];
        let out = render_notes(&horn, rate, base, &notes, 0, 1.0);
        let heard = detect_pitch(&out[..(rate as usize / 2)], rate).unwrap();
        // in tune: the note asked for, not the horn's pitch plus an octave
        assert!((heard - (base.round() + 12.0)).abs() < 0.1, "heard {heard}");
    }

    #[test]
    fn long_notes_keep_sounding_past_the_recording() {
        let rate = 48000;
        let horn = tone(200.0, rate, 0.4);
        let notes = [Note { t: 0.0, d: 2.0, key: 60, vel: 127, track: 0 }];
        let out = render_notes(&horn, rate, 60.0, &notes, 0, 1.0);
        // still loud a second and a half in, well past the 0.4 s recording
        let late = &out[(rate as f32 * 1.5) as usize..(rate as f32 * 1.6) as usize];
        assert!(late.iter().fold(0.0f32, |m, s| m.max(s.abs())) > 0.3);
    }

    #[test]
    fn reads_a_small_midi_file() {
        // format 0, 96 ticks/beat, 120 bpm: C4 for one beat, then E4 for one beat
        let mut trk = vec![];
        trk.extend([0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20]); // tempo 500000
        trk.extend([0x00, 0x90, 60, 100, 0x60, 0x80, 60, 0]);
        trk.extend([0x00, 0x90, 64, 90, 0x60, 0x80, 64, 0]);
        trk.extend([0x00, 0xFF, 0x2F, 0x00]);
        let mut f = b"MThd".to_vec();
        f.extend([0, 0, 0, 6, 0, 0, 0, 1, 0, 96]);
        f.extend(b"MTrk");
        f.extend((trk.len() as u32).to_be_bytes());
        f.extend(trk);
        let song = parse_midi(&f).unwrap();
        assert_eq!(song.notes.len(), 2);
        assert_eq!(song.notes[0].key, 60);
        assert!((song.notes[1].t - 0.5).abs() < 1e-3 && (song.notes[1].d - 0.5).abs() < 1e-3);
        assert!((song.seconds - 1.0).abs() < 1e-3);
        assert_eq!(song.tracks.len(), 1);
    }
}
