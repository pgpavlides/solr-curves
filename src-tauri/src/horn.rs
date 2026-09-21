//! Horn Music: songs played on the helicopter's horn, into voice chat.
//!
//! The instrument is a set of honks, short to long - the real WARDOGS horn,
//! cut from an OBS recording, ships built in (assets/horn). Each note uses
//! the shortest honk that lasts as long as the note, so a quick note is a real
//! quick honk (its own attack and tail) and not a long one chopped off; notes
//! longer than every honk loop the middle of the longest, with a crossfade.
//!
//! Your own set: "Record" captures what the PC plays (WASAPI loopback on the
//! default output) while you honk several times in the game, or pick a file;
//! either way it is split into its honks, each trimmed and normalised, and
//! the horn's pitch found (the median over the honks).
//!
//! A MIDI file becomes a list of notes (tempo changes honoured; channel 10,
//! the drums, marked so it can be left out). Rendering plays every note on the
//! horn - the honk resampled by 2^(semitones / 12) - mixed offline into one
//! WAV, which sound.rs plays like a pad: into the cable with the talk key
//! held, and to you.
//!
//! Files, all in C:\SolR\horn: samples\honk_N.wav (the instrument),
//! horn.json (its pitch), song.wav (the last render).

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// The WARDOGS heli horn, eight honks from 0.16 s to 1.66 s (plus their tails),
/// cut from a recording of the game.
const DEFAULT_HONKS: [&[u8]; 8] = [
    include_bytes!("../assets/horn/honk_1.wav"),
    include_bytes!("../assets/horn/honk_2.wav"),
    include_bytes!("../assets/horn/honk_3.wav"),
    include_bytes!("../assets/horn/honk_4.wav"),
    include_bytes!("../assets/horn/honk_5.wav"),
    include_bytes!("../assets/horn/honk_6.wav"),
    include_bytes!("../assets/horn/honk_7.wav"),
    include_bytes!("../assets/horn/honk_8.wav"),
];

fn folder() -> PathBuf {
    let d = crate::dir().join("horn");
    let _ = std::fs::create_dir_all(&d);
    d
}
fn samples_dir() -> PathBuf {
    let d = folder().join("samples");
    let _ = std::fs::create_dir_all(&d);
    d
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
    /// the set is your own recording, not the built-in horn
    #[serde(default)]
    custom: bool,
}

fn settings() -> Settings {
    std::fs::read_to_string(settings_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Settings { base: 60.0, detected: None, custom: false })
}
fn save_settings(s: Settings) {
    let _ = std::fs::write(settings_path(), serde_json::to_string_pretty(&s).unwrap_or_default());
}

// ---------------------------------------------------------------- the horn

#[derive(Serialize)]
pub struct HonkInfo {
    pub seconds: f32,
    /// its waveform, 48 bars of peak level 0..1
    pub peaks: Vec<f32>,
}

/// The instrument as the page shows it.
#[derive(Serialize)]
pub struct HornInfo {
    pub has: bool,
    pub base: f32,
    pub detected: Option<f32>,
    /// your own recording rather than the built-in horn
    pub custom: bool,
    /// the honks, shortest first
    pub honks: Vec<HonkInfo>,
}

/// One honk: mono samples and their rate.
struct Honk {
    m: Vec<f32>,
    rate: u32,
    path: PathBuf,
}

fn honk_files() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = std::fs::read_dir(samples_dir())
        .map(|d| d.flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "wav")).collect())
        .unwrap_or_default();
    v.sort();
    v
}

/// The honks, shortest first - the built-in horn if there is no set yet.
fn load_honks() -> Vec<Honk> {
    if honk_files().is_empty() {
        let _ = restore_defaults();
    }
    let mut v: Vec<Honk> = honk_files()
        .into_iter()
        .filter_map(|path| {
            let c = crate::audio::decode::decode_file(&path).ok()?;
            Some(Honk { m: to_mono(&c.samples, c.channels), rate: c.rate, path })
        })
        .filter(|h| !h.m.is_empty())
        .collect();
    v.sort_by_key(|h| h.m.len());
    v
}

pub fn info() -> HornInfo {
    let honks = load_honks();
    let s = settings();
    HornInfo {
        has: !honks.is_empty(),
        base: s.base,
        detected: s.detected,
        custom: s.custom,
        honks: honks.iter().map(|h| HonkInfo { seconds: h.m.len() as f32 / h.rate.max(1) as f32, peaks: peaks(&h.m, 48) }).collect(),
    }
}

pub fn set_base(base: f32) -> HornInfo {
    let mut s = settings();
    s.base = base.clamp(12.0, 120.0);
    save_settings(s);
    info()
}

fn clear_samples() {
    for p in honk_files() {
        let _ = std::fs::remove_file(p);
    }
}

/// The pitch of a set: the median of what each honk long enough to judge says.
fn set_pitch(honks: &[(Vec<f32>, u32)]) -> Option<f32> {
    let mut ps: Vec<f32> = honks
        .iter()
        .filter(|(m, r)| m.len() as f32 / *r as f32 >= 0.15)
        .filter_map(|(m, r)| detect_pitch(m, *r))
        .collect();
    if ps.is_empty() {
        return None;
    }
    ps.sort_by(|a, b| a.total_cmp(b));
    Some(ps[ps.len() / 2])
}

/// Back to the built-in WARDOGS horn.
pub fn restore_defaults() -> Result<HornInfo, String> {
    clear_samples();
    let dir = samples_dir();
    let mut set = vec![];
    for (i, bytes) in DEFAULT_HONKS.iter().enumerate() {
        let p = dir.join(format!("honk_{:02}.wav", i + 1));
        std::fs::write(&p, bytes).map_err(|e| e.to_string())?;
        if let Ok(c) = crate::audio::decode::decode_file(&p) {
            set.push((to_mono(&c.samples, c.channels), c.rate));
        }
    }
    let detected = set_pitch(&set);
    save_settings(Settings { base: detected.unwrap_or(60.0), detected, custom: false });
    Ok(info())
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
            let a = ((i as f32 * per) as usize).min(m.len() - 1);
            let b = (((i + 1) as f32 * per) as usize).clamp(a + 1, m.len());
            m[a..b].iter().fold(0.0f32, |p, s| p.max(s.abs()))
        })
        .collect()
}

fn normalise(m: &mut [f32], to: f32) {
    let peak = m.iter().fold(0.0f32, |p, s| p.max(s.abs()));
    if peak > 1e-6 {
        let k = to / peak;
        m.iter_mut().for_each(|s| *s *= k);
    }
}

/// Every honk in a recording: where the level rises above an eighth of the
/// loudest point, until it has been quiet for 60 ms. Blips under 80 ms are
/// clicks, not honks. Each keeps a little lead-in and its tail, faded.
fn split_honks(m: &[f32], rate: u32) -> Vec<Vec<f32>> {
    let hop = (rate as usize / 100).max(1); // 10 ms
    let rms: Vec<f32> = m.chunks(hop).map(|c| (c.iter().map(|s| s * s).sum::<f32>() / c.len() as f32).sqrt()).collect();
    let top = rms.iter().fold(0.0f32, |a, b| a.max(*b));
    if top < 1e-4 {
        return vec![];
    }
    let thr = top * 0.12;
    let mut spans = vec![];
    let (mut on, mut quiet) = (None::<usize>, 0);
    for (i, v) in rms.iter().enumerate() {
        if *v > thr {
            on.get_or_insert(i);
            quiet = 0;
        } else if let Some(a) = on {
            quiet += 1;
            if quiet >= 6 {
                spans.push((a, i + 1 - quiet));
                on = None;
                quiet = 0;
            }
        }
    }
    if let Some(a) = on {
        spans.push((a, rms.len()));
    }
    let r = rate as f32;
    let starts: Vec<usize> = spans.iter().map(|s| s.0 * hop).collect();
    spans
        .iter()
        .enumerate()
        .filter(|(_, (a, b))| (b - a) * hop >= (r * 0.08) as usize)
        .map(|(k, (a, b))| {
            let s = (a * hop).saturating_sub((r * 0.015) as usize);
            let next = starts.get(k + 1).map_or(m.len(), |n| n.saturating_sub((r * 0.02) as usize));
            let e = (b * hop + (r * 0.10) as usize).min(next).min(m.len());
            let mut x = m[s..e.max(s)].to_vec();
            let (fi, fo) = ((r * 0.005) as usize, (r * 0.04) as usize);
            for i in 0..fi.min(x.len()) {
                x[i] *= i as f32 / fi as f32;
            }
            let n = x.len();
            for i in 0..fo.min(n) {
                x[n - 1 - i] *= i as f32 / fo as f32;
            }
            normalise(&mut x, 0.9);
            x
        })
        .collect()
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

/// A recording (or a picked file) becomes the instrument: its honks, split.
fn make_instrument(mono: Vec<f32>, rate: u32) -> Result<HornInfo, String> {
    let honks = split_honks(&mono, rate);
    if honks.is_empty() {
        return Err("No honk was heard - honk while it records (and keep other sound down).".into());
    }
    clear_samples();
    let dir = samples_dir();
    for (i, h) in honks.iter().enumerate() {
        write_wav(&dir.join(format!("honk_{:02}.wav", i + 1)), h, rate)?;
    }
    let set: Vec<(Vec<f32>, u32)> = honks.into_iter().map(|h| (h, rate)).collect();
    let detected = set_pitch(&set);
    // the exact pitch, not the nearest note: a horn between two notes still plays in tune
    save_settings(Settings { base: detected.unwrap_or(60.0), detected, custom: true });
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
    std::thread::sleep(Duration::from_secs_f32(seconds.clamp(1.0, 20.0)));
    drop(stream);
    let raw = std::mem::take(&mut *got.lock().unwrap());
    let mono = to_mono(&raw, channels);
    let _ = write_wav(&folder().join("horn_raw.wav"), &mono, rate);
    make_instrument(mono, rate)
}

/// Use a sound file (or a video: its sound) instead of a recording.
pub fn load_file(bytes: Vec<u8>, ext: String) -> Result<HornInfo, String> {
    let ext: String = ext.chars().filter(|c| c.is_ascii_alphanumeric()).take(5).collect();
    let tmp = folder().join(format!("horn_pick.{ext}"));
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    let clip = crate::audio::decode::decode_file(&tmp).map_err(|e| format!("Can't read that file: {e:#}"));
    let _ = std::fs::remove_file(&tmp);
    let clip = clip?;
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

/// Linear interpolation into a honk.
fn at(s: &[f32], p: f64) -> f32 {
    let i = p.floor() as usize;
    if i + 1 >= s.len() {
        return s.last().copied().unwrap_or(0.0);
    }
    let f = (p - i as f64) as f32;
    s[i] * (1.0 - f) + s[i + 1] * f
}

/// Every note on the horn, mixed into one track. `honks` shortest first, all
/// at `rate`.
pub fn render_notes(honks: &[Vec<f32>], rate: u32, base: f32, notes: &[Note], transpose: i32, speed: f32) -> Vec<f32> {
    let r = rate as f64;
    let speed = speed.clamp(0.25, 4.0) as f64;
    let release = 0.05;
    let attack = (r * 0.005).max(1.0);
    let end = notes.iter().fold(0.0f64, |m, x| m.max((x.t as f64 + (x.d as f64).max(0.08)) / speed)) + 2.0;
    let mut out = vec![0.0f32; ((end.min(600.0)) * r) as usize + 1];
    if honks.is_empty() {
        return out;
    }
    for note in notes {
        let start = (note.t as f64 / speed * r) as usize;
        if start >= out.len() {
            continue;
        }
        let ratio = 2f64.powf((note.key as f64 + transpose as f64 - base as f64) / 12.0);
        let held = ((note.d as f64).max(0.08) / speed * r) as usize;
        // the shortest honk that lasts the note (at this pitch it plays 1/ratio as long)
        let honk_out = |h: &Vec<f32>| (h.len() as f64 / ratio) as usize;
        let pick = honks.iter().position(|h| honk_out(h) >= held).unwrap_or(honks.len() - 1);
        let horn = &honks[pick];
        let n = horn.len();
        // only a note longer than the longest honk loops (its steady middle)
        let (ls, le) = (n as f64 * 0.3, n as f64 * 0.8);
        let loop_len = le - ls;
        let can_loop = honk_out(horn) < held && loop_len > r * 0.05;
        let xf = (r * 0.02).min(loop_len / 4.0);
        let gain = 0.35 + 0.65 * note.vel as f32 / 127.0;
        let total = held + (release * r) as usize;
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
    // no trailing silence past the last sound
    let last = out.iter().rposition(|s| s.abs() > 1e-4).unwrap_or(0);
    out.truncate((last + (r * 0.1) as usize).min(out.len()));
    normalise(&mut out, 0.89);
    out
}

pub fn render(notes: Vec<Note>, transpose: i32, speed: f32) -> Result<Rendered, String> {
    let honks = load_honks();
    let rate = honks.first().map(|h| h.rate).ok_or("There is no horn - record it or restore the default.")?;
    if notes.is_empty() {
        return Err("No notes to play - pick at least one track.".into());
    }
    let set: Vec<Vec<f32>> = honks.into_iter().filter(|h| h.rate == rate).map(|h| h.m).collect();
    let out = render_notes(&set, rate, settings().base, &notes, transpose, speed);
    write_wav(&song_path(), &out, rate)?;
    // loaded and fitted to the devices now, so Play starts the moment it's pressed
    crate::sound::preload(song_path());
    Ok(Rendered { seconds: out.len() as f32 / rate as f32, notes: notes.len() })
}

// ---------------------------------------------------------------- songs as sounds

/// The built-in songs, each rendered to its own file, so a stick button can
/// play one like any soundboard sound (the Macros page lists them).
fn songs_dir() -> PathBuf {
    let d = folder().join("songs");
    let _ = std::fs::create_dir_all(&d);
    d
}

#[derive(Deserialize)]
pub struct SongOut {
    pub name: String,
    pub notes: Vec<Note>,
}

/// "Hedwig's Theme" -> horn_Hedwig's Theme.wav (the "horn_" groups them in the picker)
fn song_file(name: &str) -> String {
    let safe: String = name.chars().map(|c| if "\\/:*?\"<>|".contains(c) { '-' } else { c }).collect();
    format!("horn_{}.wav", safe.trim())
}

/// What the song files were made from: the horn set, its pitch, the songs.
fn songs_stamp(songs: &[SongOut]) -> String {
    let honks: Vec<(String, u64)> = honk_files()
        .iter()
        .map(|p| (p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(), std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)))
        .collect();
    let s = settings();
    let songs: Vec<(&str, Vec<(u32, u32, u8)>)> =
        songs.iter().map(|x| (x.name.as_str(), x.notes.iter().map(|n| ((n.t * 1000.0) as u32, (n.d * 1000.0) as u32, n.key)).collect())).collect();
    serde_json::to_string(&(honks, (s.base * 1000.0) as i64, songs)).unwrap_or_default()
}

/// Render every built-in song to C:\SolR\horn\songs - only when the horn or
/// the songs changed since last time. Returns each song's file, full path.
pub fn export_songs(songs: Vec<SongOut>) -> Result<Vec<String>, String> {
    let dir = songs_dir();
    let stamp_path = dir.join("stamp.json");
    let stamp = songs_stamp(&songs);
    let paths: Vec<PathBuf> = songs.iter().map(|s| dir.join(song_file(&s.name))).collect();
    let fresh = std::fs::read_to_string(&stamp_path).ok().as_deref() == Some(stamp.as_str()) && paths.iter().all(|p| p.exists());
    if !fresh {
        let honks = load_honks();
        let rate = honks.first().map(|h| h.rate).ok_or("There is no horn.")?;
        let set: Vec<Vec<f32>> = honks.into_iter().filter(|h| h.rate == rate).map(|h| h.m).collect();
        let base = settings().base;
        // songs no longer in the list go
        for old in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
            let p = old.path();
            if p.extension().is_some_and(|x| x == "wav") && !paths.contains(&p) {
                let _ = std::fs::remove_file(p);
            }
        }
        for (s, p) in songs.iter().zip(&paths) {
            write_wav(p, &render_notes(&set, rate, base, &s.notes, 0, 1.0), rate)?;
        }
        std::fs::write(&stamp_path, &stamp).map_err(|e| e.to_string())?;
        // buttons already playing these: load the new versions
        crate::sound::forget(paths.clone());
    }
    Ok(paths.iter().map(|p| p.to_string_lossy().replace('\\', "/")).collect())
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

/// One honk of the set (shortest = 0), on you only.
pub fn hear_honk(index: usize) -> Result<(), String> {
    let honks = load_honks();
    let h = honks.get(index).or(honks.last()).ok_or("There is no horn.")?;
    crate::sound::play_file(h.path.clone(), false);
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
    fn loud(x: &[f32]) -> f32 {
        x.iter().fold(0.0f32, |m, s| m.max(s.abs()))
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
    fn splits_a_recording_into_its_honks() {
        let rate = 48000;
        let gap = |s: f32| vec![0.0f32; (rate as f32 * s) as usize];
        let mut m = gap(0.5);
        m.extend(tone(300.0, rate, 0.2));
        m.extend(gap(0.6));
        m.extend(tone(300.0, rate, 0.03)); // a click, not a honk
        m.extend(gap(0.6));
        m.extend(tone(300.0, rate, 1.0));
        m.extend(gap(0.5));
        let honks = split_honks(&m, rate);
        assert_eq!(honks.len(), 2, "the click is dropped");
        let secs: Vec<f32> = honks.iter().map(|h| h.len() as f32 / rate as f32).collect();
        assert!(secs[0] > 0.2 && secs[0] < 0.35, "{secs:?}");
        assert!(secs[1] > 1.0 && secs[1] < 1.15, "{secs:?}");
    }

    #[test]
    fn an_octave_up_plays_in_tune() {
        let rate = 48000;
        let horn = tone(200.0, rate, 1.0);
        let base = 69.0 + 12.0 * (200.0f32 / 440.0).log2(); // 200 Hz, between notes
        let notes = [Note { t: 0.0, d: 0.5, key: (base.round() as u8) + 12, vel: 127, track: 0 }];
        let out = render_notes(&[horn], rate, base, &notes, 0, 1.0);
        let heard = detect_pitch(&out[..(rate as usize / 2)], rate).unwrap();
        // the note asked for, not the horn's pitch plus an octave
        assert!((heard - (base.round() + 12.0)).abs() < 0.1, "heard {heard}");
    }

    #[test]
    fn a_short_note_uses_the_short_honk() {
        let rate = 48000;
        // a short honk at 300 Hz and a long one an octave lower, same "base"
        // so the pick shows in the pitch that comes out
        let short = tone(300.0, rate, 0.25);
        let long = tone(150.0, rate, 1.5);
        let base = 60.0;
        let short_note = [Note { t: 0.0, d: 0.15, key: 60, vel: 127, track: 0 }];
        let out = render_notes(&[short.clone(), long.clone()], rate, base, &short_note, 0, 1.0);
        let f = detect_pitch(&out[..(rate as f32 * 0.14) as usize], rate).unwrap();
        assert!((f - (69.0 + 12.0 * (300.0f32 / 440.0).log2())).abs() < 0.2, "short note played the short honk: {f}");
        let long_note = [Note { t: 0.0, d: 1.0, key: 60, vel: 127, track: 0 }];
        let out = render_notes(&[short, long], rate, base, &long_note, 0, 1.0);
        let f = detect_pitch(&out[(rate as f32 * 0.4) as usize..(rate as f32 * 0.7) as usize], rate).unwrap();
        assert!((f - (69.0 + 12.0 * (150.0f32 / 440.0).log2())).abs() < 0.2, "long note played the long honk: {f}");
    }

    #[test]
    fn long_notes_keep_sounding_past_the_longest_honk() {
        let rate = 48000;
        let horn = tone(200.0, rate, 0.4);
        let notes = [Note { t: 0.0, d: 2.0, key: 60, vel: 127, track: 0 }];
        let out = render_notes(&[horn], rate, 60.0, &notes, 0, 1.0);
        // still loud a second and a half in, well past the 0.4 s honk
        assert!(loud(&out[(rate as f32 * 1.5) as usize..(rate as f32 * 1.6) as usize]) > 0.3);
    }

    #[test]
    fn the_built_in_horn_decodes_and_is_in_tune_with_itself() {
        let dir = std::env::temp_dir().join("solr_horn_test");
        let _ = std::fs::create_dir_all(&dir);
        let mut set = vec![];
        for (i, b) in DEFAULT_HONKS.iter().enumerate() {
            let p = dir.join(format!("h{i}.wav"));
            std::fs::write(&p, b).unwrap();
            let c = crate::audio::decode::decode_file(&p).unwrap();
            set.push((to_mono(&c.samples, c.channels), c.rate));
        }
        let lens: Vec<f32> = set.iter().map(|(m, r)| m.len() as f32 / *r as f32).collect();
        assert!(lens.windows(2).all(|w| w[0] <= w[1]), "shortest first: {lens:?}");
        let p = set_pitch(&set).unwrap();
        // the WARDOGS horn: E4 and a bit over half a semitone
        assert!((p - 64.56).abs() < 0.1, "{p}");
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
