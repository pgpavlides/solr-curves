//! Voice control sounds: a pad button on the stick plays the clip its bank
//! assigns to it.
//!
//! Same path as the WARDOGS soundboard app (the `audio` engine is its code):
//! every clip goes to the virtual cable - VB-CABLE's "CABLE Input", which the
//! game uses as its microphone - and to a local monitor (the Focusrite) so you
//! hear what you fired. The device choices are the soundboard's own, read from
//! its settings file, so both apps always agree.
//!
//! All the work happens on one thread fed by a channel: the stick's callback
//! (hidraw.rs) only sends "button N went down in bank B" and returns at once.
//! Clips are decoded and resampled when the bank setup changes, so a press is
//! just a queue push.
//!
//! Push-to-talk (ptt.rs): the game only transmits while its talk key - Caps
//! Lock - is down. So a pad press holds Caps Lock, starts the clip a moment
//! later (the voice chat needs the key down before the first word), and lets
//! go when the last clip playing has ended, plus a short tail for the audio
//! still in the cable's buffers. `"ptt": false` in hotas_voice.json turns it off.

use crate::audio::{
    decode,
    devices,
    engine::Engine,
    resample::{prepare, Prepared},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Talk key down this long before the clip starts ...
const PTT_LEAD: Duration = Duration::from_millis(120);
/// ... and held this long after it ends (cable + voice chat buffering).
const PTT_TAIL: Duration = Duration::from_millis(350);
use tauri::{AppHandle, Emitter};

enum Job {
    /// A stick button went down; `bank` is the knob position (0-3) at the time.
    Press { button: u16, bank: Option<usize> },
    /// The bank setup changed (hotas_voice.json as saved).
    Config(Value),
    /// Play one file on the monitor only - trying a clip out while setting up.
    Preview(PathBuf),
    /// Play one file loaded fresh (a rendered horn song): into the game with
    /// the talk key held like a pad, or with `game` false on the monitor only.
    PlayFile { path: PathBuf, game: bool },
    /// Load a file ready for PlayFile (a horn song, right after it renders),
    /// so pressing Play starts it at once.
    Preload(PathBuf),
    Stop,
    /// Open the devices again (after installing VB-CABLE, replugging, ...).
    Reopen,
    /// The app is closing: let go of the talk key, then say so.
    Quit(mpsc::Sender<()>),
}

#[derive(Clone, Serialize, Default)]
pub struct SoundStatus {
    /// The cable the game hears ("CABLE Input ..."), once open.
    pub cable: Option<String>,
    /// Where you hear it yourself.
    pub monitor: Option<String>,
    /// Clips ready to play.
    pub loaded: usize,
    /// Anything that went wrong: devices, files that wouldn't load.
    pub errors: Vec<String>,
    /// No cable, but its driver is still in Windows: the Repair button can fix it.
    pub cable_repairable: bool,
}

/// A horn song has started playing (or couldn't).
#[derive(Clone, Serialize)]
struct HornStarted {
    error: Option<String>,
    /// its length, as it plays
    seconds: f32,
    /// how long loading it took before it could start
    load_ms: u64,
}

/// What the frontend is told each time a pad fires.
#[derive(Clone, Serialize)]
struct Fired {
    button: u16,
    bank: Option<usize>,
    file: Option<String>,
    error: Option<String>,
}

static TX: OnceLock<Mutex<mpsc::Sender<Job>>> = OnceLock::new();
static STATUS: Mutex<Option<SoundStatus>> = Mutex::new(None);

/// The soundboard app's saved device choices (only the fields used here).
#[derive(Deserialize, Default)]
struct BoardSettings {
    main: Option<Choice>,
    monitor: Option<Choice>,
    #[serde(default)]
    monitor_off: bool,
    master_gain: Option<f32>,
    monitor_gain: Option<f32>,
}
#[derive(Deserialize)]
struct Choice {
    id: String,
}

fn board_settings() -> BoardSettings {
    std::env::var_os("LOCALAPPDATA")
        .map(|b| PathBuf::from(b).join("gr.iegroup.wardogs.soundboard").join("settings.json"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[derive(Clone)]
struct Clip {
    cable: Option<Arc<Prepared>>,
    monitor: Option<Arc<Prepared>>,
}

struct Worker {
    app: AppHandle,
    cable: Option<Engine>,
    monitor: Option<Engine>,
    config: Value,
    clips: HashMap<PathBuf, Clip>,
    device_errors: Vec<String>,
    file_errors: Vec<String>,
    ptt: crate::ptt::Ptt,
    /// When the talk key goes up (the end of the last clip + tail).
    ptt_until: Option<Instant>,
    /// A file loaded ahead of playing it (the horn song, as rendered).
    ready: Option<(PathBuf, Clip)>,
}

/// Which file a bank puts on a button: banks[bank].folder + banks[bank].pads["<button>"].
fn assigned(config: &Value, bank: usize, button: u16) -> Option<PathBuf> {
    let b = config.get(crate::macros::banks_for(button))?.get(bank)?;
    let folder = b.get("folder")?.as_str()?;
    let file = b.get("pads")?.get(button.to_string())?.as_str()?;
    (!folder.is_empty() && !file.is_empty()).then(|| Path::new(folder).join(file))
}

fn all_assigned(config: &Value) -> Vec<PathBuf> {
    let mut out = vec![];
    let most = ["banks", "throttleBanks"]
        .iter()
        .filter_map(|k| config.get(*k).and_then(|b| b.as_array()).map(|b| b.len()))
        .max();
    if let Some(n) = most {
        for i in 0..n {
            for button in 1..=128 {
                if let Some(p) = assigned(config, i, button) {
                    if !out.contains(&p) {
                        out.push(p);
                    }
                }
            }
        }
    }
    out
}

impl Worker {
    /// The soundboard's saved choice, else the best match: Windows renames and
    /// re-ids devices when it re-enumerates them ("2- Focusrite" -> "3- Focusrite").
    fn open_devices(&mut self) {
        self.cable = None;
        self.monitor = None;
        self.device_errors.clear();
        let s = board_settings();
        let outs = devices::list_outputs().unwrap_or_default();
        let present = |id: &str| outs.iter().any(|d| d.id == id);

        let key = s.main.map(|c| c.id).filter(|id| present(id)).or_else(|| devices::suggested_virtual_sink().map(|d| d.id));
        match &key {
            None => self.device_errors.push(if crate::vbcable::stored_inf().is_some() {
                "No VB-CABLE device, so the game can't hear the sounds. Its driver is still in Windows: Repair VB-CABLE puts it back.".into()
            } else {
                "VB-CABLE isn't installed, so the game can't hear the sounds. Get it from vb-audio.com/Cable, run the setup as administrator from the unzipped folder, then Reconnect.".into()
            }),
            Some(k) => match Engine::start(Some(k)) {
                Ok(e) => {
                    let _ = e.set_master(s.master_gain.unwrap_or(1.0));
                    self.cable = Some(e);
                }
                Err(e) => self.device_errors.push(format!("cable: {e:#}")),
            },
        }
        if !s.monitor_off {
            let mkey = s.monitor.map(|c| c.id).filter(|id| present(id)).or_else(|| devices::suggested_monitor().map(|d| d.id));
            // never monitor into the cable itself: every clip would go out twice
            if mkey.is_some() && mkey != key {
                match Engine::start(mkey.as_deref()) {
                    Ok(e) => {
                        let _ = e.set_master(s.monitor_gain.unwrap_or(1.0));
                        self.monitor = Some(e);
                    }
                    Err(e) => self.device_errors.push(format!("monitor: {e:#}")),
                }
            }
        }
    }

    fn load(&self, path: &Path) -> Result<Clip, String> {
        let src = decode::decode_file(path).map_err(|e| format!("{e:#}"))?;
        let fit = |e: &Engine| prepare(&src, e.rate, e.channels).map(Arc::new).map_err(|e| format!("{e:#}"));
        let cable = self.cable.as_ref().map(fit).transpose()?;
        let monitor = match (&self.monitor, &cable) {
            (Some(m), Some(c)) if Some((m.rate, m.channels)) == self.cable.as_ref().map(|e| (e.rate, e.channels)) => Some(c.clone()),
            (Some(m), _) => Some(fit(m)?),
            (None, _) => None,
        };
        Ok(Clip { cable, monitor })
    }

    /// Decode every clip the banks use (and drop the ones they no longer do).
    fn apply_config(&mut self, config: Value) {
        self.config = config;
        let want = all_assigned(&self.config);
        self.clips.retain(|p, _| want.contains(p));
        self.file_errors.clear();
        if self.cable.is_none() && self.monitor.is_none() {
            return;
        }
        for p in want {
            if self.clips.contains_key(&p) {
                continue;
            }
            match self.load(&p) {
                Ok(c) => {
                    self.clips.insert(p, c);
                }
                Err(e) => self.file_errors.push(format!("{}: {e}", p.display())),
            }
        }
    }

    fn publish(&self) {
        let st = SoundStatus {
            cable: self.cable.as_ref().map(|e| e.device_name.clone()),
            monitor: self.monitor.as_ref().map(|e| e.device_name.clone()),
            loaded: self.clips.len(),
            errors: self.device_errors.iter().chain(&self.file_errors).cloned().collect(),
            cable_repairable: self.cable.is_none() && crate::vbcable::stored_inf().is_some(),
        };
        *STATUS.lock().unwrap() = Some(st.clone());
        let _ = self.app.emit("solr:sound-status", st);
    }

    fn press(&mut self, button: u16, bank: Option<usize>) {
        // the editor is open: the stick shouldn't play anything into the game
        if crate::macros::suppressed() {
            return;
        }
        // the stop button ("stopButton", default 11): silence everything, let go of Caps Lock
        let stop_button = self.config.get("stopButton").and_then(|v| v.as_u64()).unwrap_or(11);
        if stop_button > 0 && button as u64 == stop_button {
            self.stop();
            let _ = self.app.emit("solr:sound-stopped", button);
            return;
        }
        let Some(path) = bank.and_then(|b| assigned(&self.config, b, button)) else { return };
        let file = path.file_name().map(|n| n.to_string_lossy().into_owned());
        let error = match self.clips.get(&path).cloned() {
            None => Some("not loaded".to_string()),
            Some(c) => self.play_clip(&c),
        };
        let _ = self.app.emit("solr:sound", Fired { button, bank, file, error });
    }

    /// Into the game: talk key down, the cable, and the monitor for you.
    fn play_clip(&mut self, c: &Clip) -> Option<String> {
        let mut err = None;
        // talk key down first, so the game is transmitting from the first word
        if let (Some(e), Some(buf), true) = (&self.cable, &c.cable, self.ptt_enabled()) {
            let was_held = self.ptt.held();
            match self.ptt.press() {
                Ok(()) => {
                    if !was_held {
                        self.emit_ptt();
                        std::thread::sleep(PTT_LEAD);
                    }
                    let secs = buf.frames() as f64 / e.rate.max(1) as f64;
                    let until = Instant::now() + Duration::from_secs_f64(secs) + PTT_TAIL;
                    self.ptt_until = Some(self.ptt_until.map_or(until, |u| u.max(until)));
                }
                Err(e) => err = Some(format!("Caps Lock: {e}")),
            }
        }
        let played = match (&self.cable, &c.cable) {
            (Some(e), Some(buf)) => e.play(buf.clone(), 1.0).err().map(|e| format!("{e:#}")),
            _ => Some("no VB-CABLE - only you hear it".into()),
        };
        if played.is_some() {
            err = played;
        }
        // the monitor is for you only; a hiccup there doesn't stop the clip going out
        if let (Some(m), Some(buf)) = (&self.monitor, &c.monitor) {
            if let Err(e) = m.play(buf.clone(), 1.0) {
                err.get_or_insert(format!("monitor: {e:#}"));
            }
        }
        err
    }

    /// A file that isn't one of the banks' (the horn song): loaded each time,
    /// since it changes every render. Says when it really started - loading
    /// and fitting it to the devices takes a moment, and the page's timeline
    /// should start with the sound, not with the click.
    fn play_file(&mut self, path: PathBuf, game: bool) {
        let asked = Instant::now();
        // the song preloaded when it rendered - kept, it may be played again
        let loaded = match &self.ready {
            Some((p, c)) if *p == path => Ok(c.clone()),
            _ => self.load(&path),
        };
        let load_ms = asked.elapsed().as_millis() as u64;
        let (error, seconds) = match loaded {
            Err(e) => (Some(e), 0.0),
            Ok(c) => {
                let seconds = c.monitor.as_ref().or(c.cable.as_ref()).map_or(0.0, |b| {
                    let rate = if c.monitor.is_some() { self.monitor.as_ref().map(|e| e.rate) } else { self.cable.as_ref().map(|e| e.rate) };
                    b.frames() as f32 / rate.unwrap_or(48000).max(1) as f32
                });
                let err = if game {
                    self.play_clip(&c)
                } else {
                    match (&self.monitor, &c.monitor) {
                        (Some(m), Some(buf)) => m.play(buf.clone(), 1.0).err().map(|e| format!("{e:#}")),
                        _ => Some("no monitor device to play it on".into()),
                    }
                };
                (err, seconds)
            }
        };
        let _ = self.app.emit("solr:horn-playing", HornStarted { error, seconds, load_ms });
    }

    fn preview(&mut self, path: PathBuf) {
        let clip = match self.clips.get(&path) {
            Some(c) => c.monitor.clone(),
            None => self.load(&path).ok().and_then(|c| c.monitor),
        };
        if let (Some(m), Some(buf)) = (&self.monitor, clip) {
            let _ = m.play(buf, 1.0);
        }
    }

    fn stop(&mut self) {
        for e in [&self.cable, &self.monitor].into_iter().flatten() {
            let _ = e.stop_all();
        }
        self.release_ptt();
    }

    fn ptt_enabled(&self) -> bool {
        self.config.get("ptt").and_then(|v| v.as_bool()).unwrap_or(true)
    }

    fn release_ptt(&mut self) {
        self.ptt_until = None;
        if self.ptt.held() {
            self.ptt.release();
            self.emit_ptt();
        }
    }

    fn emit_ptt(&self) {
        let _ = self.app.emit("solr:ptt", self.ptt.held());
    }
}

/// Start the sound thread: open the devices and load the saved banks.
pub fn start(app: &AppHandle, config: Value) {
    let (tx, rx) = mpsc::channel::<Job>();
    if TX.set(Mutex::new(tx)).is_err() {
        return;
    }
    let app = app.clone();
    let _ = std::thread::Builder::new().name("solr-sound".into()).spawn(move || {
        let mut w = Worker {
            app,
            cable: None,
            monitor: None,
            config: Value::Null,
            clips: HashMap::new(),
            device_errors: vec![],
            file_errors: vec![],
            ptt: Default::default(),
            ptt_until: None,
            ready: None,
        };
        w.open_devices();
        w.apply_config(config);
        w.publish();
        loop {
            // while the talk key is down, wake up when it's time to let go
            let job = match w.ptt_until {
                None => match rx.recv() {
                    Ok(j) => j,
                    Err(_) => break,
                },
                Some(until) => match rx.recv_timeout(until.saturating_duration_since(Instant::now())) {
                    Ok(j) => j,
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        w.release_ptt();
                        continue;
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                },
            };
            match job {
                Job::Press { button, bank } => w.press(button, bank),
                Job::Config(c) => {
                    w.apply_config(c);
                    w.publish();
                }
                Job::Preview(p) => w.preview(p),
                Job::PlayFile { path, game } => w.play_file(path, game),
                Job::Preload(path) => w.ready = w.load(&path).ok().map(|c| (path, c)),
                Job::Stop => w.stop(),
                Job::Quit(done) => {
                    w.release_ptt();
                    let _ = done.send(());
                    break;
                }
                Job::Reopen => {
                    w.open_devices();
                    w.clips.clear(); // prepared for the old devices' rates
                    w.ready = None;
                    let c = w.config.clone();
                    w.apply_config(c);
                    w.publish();
                }
            }
        }
    });
}

fn send(job: Job) {
    if let Some(tx) = TX.get() {
        if let Ok(tx) = tx.lock() {
            let _ = tx.send(job);
        }
    }
}

/// From the stick's callback: never blocks.
pub fn press(button: u16, bank: Option<usize>) {
    send(Job::Press { button, bank });
}
pub fn set_config(config: Value) {
    send(Job::Config(config));
}
pub fn preview(path: PathBuf) {
    send(Job::Preview(path));
}
pub fn stop() {
    send(Job::Stop);
}
pub fn play_file(path: PathBuf, game: bool) {
    send(Job::PlayFile { path, game });
}
pub fn preload(path: PathBuf) {
    send(Job::Preload(path));
}
/// On exit: never leave Caps Lock held down.
pub fn shutdown() {
    let (tx, rx) = mpsc::channel();
    send(Job::Quit(tx));
    let _ = rx.recv_timeout(Duration::from_millis(500));
}
pub fn reopen() {
    send(Job::Reopen);
}
pub fn status() -> Option<SoundStatus> {
    STATUS.lock().unwrap().clone()
}

const AUDIO_EXTS: &[&str] = &["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus"];

/// The sound files in a folder (not its subfolders), sorted by name.
pub fn files(folder: &Path) -> Result<Vec<String>, String> {
    let rd = std::fs::read_dir(folder).map_err(|e| format!("{}: {e}", folder.display()))?;
    let mut out: Vec<String> = rd
        .flatten()
        .filter(|e| e.path().is_file())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| {
            Path::new(n)
                .extension()
                .and_then(|x| x.to_str())
                .is_some_and(|x| AUDIO_EXTS.contains(&x.to_ascii_lowercase().as_str()))
        })
        .collect();
    out.sort();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bank_assigns_a_file_per_button() {
        let c = serde_json::json!({ "banks": [
            { "folder": "E:/WARDOGS_SOUNDBOARD", "pads": { "5": "heli_hello.mp3", "16": "" } },
            { "pads": { "5": "x.mp3" } }
        ]});
        assert_eq!(assigned(&c, 0, 5), Some(Path::new("E:/WARDOGS_SOUNDBOARD").join("heli_hello.mp3")));
        assert_eq!(assigned(&c, 0, 16), None, "empty = nothing on that button");
        assert_eq!(assigned(&c, 0, 6), None);
        assert_eq!(assigned(&c, 1, 5), None, "no folder, no sound");
        assert_eq!(all_assigned(&c).len(), 1);
    }
}

