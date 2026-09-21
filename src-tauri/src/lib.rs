//! The bridge between the curve editor and T.A.R.G.E.T.
//!
//! Three files, all next to the .tmc script (C:\SolR unless SOLR_DIR says otherwise):
//!
//! - `hotas_curves.json`  the app's own state (what the sliders were)
//! - `hotas_curves.txt`   the lookup tables the script reads, plus a log line
//! - `hotas_curves.ack`   written BY THE SCRIPT: the table number it loaded.
//!                        The only proof a change reached T.A.R.G.E.T.
//!
//! This replaces the dev-server middleware in vite.config.ts, which stays for
//! running the UI in a plain browser (and for the browser tests). Both must
//! write the table in exactly the same format.

mod audio;
mod devices;
mod hidraw;
mod horn;
mod led;
mod macros;
mod memory;
mod ptt;
mod sound;
mod target;
mod thrbank;
mod tray;
mod tmsc;
mod vbcable;

use serde::Serialize;
use serde_json::Value;
use std::{fs, path::PathBuf, thread, time::Duration};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// roll, pitch, yaw and the Sol-R 6 Throttle's lever, 257 samples each
const NTAB: usize = 4 * 257;
const AMAX: i32 = 32767;

/*
  Blocking work - calls into Thrustmaster's DLLs, `sc` / `tasklist`, waits -
  runs on its own thread, never on the async workers. With Thrustmaster's
  service down, a DLL call can hang for good; on a worker, a few of those
  (the app retries some every few seconds) blocked every other command,
  including the button that would start the service again.
*/
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())
}

/// Where everything lives: curves, presets, styles, voice settings, scripts.
/// C:\SolR - short and without spaces, because the T.A.R.G.E.T. script has the
/// path written into it. (It used to be E:\; see migrate_from_e.)
pub const DATA_DIR: &str = "C:/SolR/";

fn dir() -> PathBuf {
    PathBuf::from(std::env::var("SOLR_DIR").unwrap_or_else(|_| DATA_DIR.into()))
}

/*
  One-time move from E:\ (where it all lived before): copy every file that
  isn't in C:\SolR yet. Copies, never moves - E:\ keeps its files as they were.
*/
fn migrate_from_e() {
    let to = dir();
    let _ = fs::create_dir_all(&to);
    if std::env::var("SOLR_DIR").is_ok() {
        return; // tests and custom folders: leave alone
    }
    let from = PathBuf::from("E:/");
    let names = ["hotas_curves.json", "hotas_presets.json", "hotas_curve_styles.json", "hotas_voice.json"];
    let mut files: Vec<String> = names.iter().map(|s| s.to_string()).collect();
    // the user's own scripts too (not the built-in one: the app writes that fresh)
    if let Ok(rd) = fs::read_dir(&from) {
        for e in rd.flatten() {
            let n = e.file_name().to_string_lossy().into_owned();
            if n.to_lowercase().ends_with(".tmc") && n != target::SCRIPT_NAME {
                files.push(n);
            }
        }
    }
    for n in files {
        let (src, dst) = (from.join(&n), to.join(&n));
        if src.exists() && !dst.exists() {
            let _ = fs::copy(&src, &dst);
        }
    }
}

/*
  Write to a temp file and rename over the target, so the script never sees a
  half-written table. The rename fails while the script has the file open (it
  does, briefly, four times a second), hence the retries. The table number at
  both ends of the file is the script's second line of defence.
*/
fn atomic_write(name: &str, data: &[u8]) -> Result<(), String> {
    atomic_write_in(&dir(), name, data)
}

fn atomic_write_in(dir: &std::path::Path, name: &str, data: &[u8]) -> Result<(), String> {
    let _ = fs::create_dir_all(dir);
    let file = dir.join(name);
    let tmp = dir.join(format!("{name}.tmp"));
    fs::write(&tmp, data).map_err(|e| format!("write {}: {e}", tmp.display()))?;
    // the script reads the table 4x a second and a file can't be replaced
    // while it's open: keep trying for ~1.5 s ...
    for _ in 0..60 {
        if fs::rename(&tmp, &file).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(25));
    }
    // ... then write it in place. The script opens it shared, so this works
    // even mid-read; a half-written table fails its table-number-at-both-ends
    // check and is simply read again on the next poll.
    let r = fs::write(&file, data).map_err(|e| format!("write {}: {e}", file.display()));
    let _ = fs::remove_file(&tmp);
    r
}

#[derive(Serialize)]
struct Loaded {
    state: Option<Value>,
    dir: String,
}

/// The saved app state, if any, and the folder the files live in.
#[tauri::command]
fn load_state() -> Loaded {
    let state = fs::read_to_string(dir().join("hotas_curves.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    let mut d = dir().to_string_lossy().replace('\\', "/");
    if !d.ends_with('/') {
        d.push('/');
    }
    Loaded { state, dir: d }
}

/// Write the tables for the script, then the app state.
#[tauri::command]
async fn save_state(state: Value, table: Vec<i64>, gen: i64, note: String) -> Result<i64, String> {
    if table.len() != NTAB || table.iter().any(|v| v.abs() > AMAX as i64) || gen <= 0 {
        return Err("bad table".into());
    }
    let rows: Vec<String> = table
        .chunks(16)
        .map(|c| c.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(" "))
        .collect();
    // the log line the script prints: printable ASCII, one line, after '#'
    let log: String = note
        .chars()
        .map(|c| if (' '..='~').contains(&c) { c } else { '?' })
        .take(190)
        .collect();
    let txt = format!("{gen}\r\n{}\r\n{gen}\r\n#{log}\r\n", rows.join("\r\n"));
    atomic_write("hotas_curves.txt", txt.as_bytes())?;
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    atomic_write("hotas_curves.json", json.as_bytes())?;
    Ok(gen)
}

/// The table number the script last loaded, or None if it never has.
#[tauri::command]
fn read_ack() -> Option<i64> {
    fs::read_to_string(dir().join("hotas_curves.ack"))
        .ok()
        .and_then(|s| s.trim().parse().ok())
}

/// Saved presets (`hotas_presets.json`): a JSON array, empty if none yet.
#[tauri::command]
fn load_presets() -> Value {
    fs::read_to_string(dir().join("hotas_presets.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_array())
        .unwrap_or_else(|| Value::Array(vec![]))
}

#[tauri::command]
async fn save_presets(presets: Value) -> Result<(), String> {
    if !presets.is_array() {
        return Err("presets must be a list".into());
    }
    let json = serde_json::to_string_pretty(&presets).map_err(|e| e.to_string())?;
    atomic_write("hotas_presets.json", json.as_bytes())
}

/// Saved curve styles (`hotas_curve_styles.json`): single curve shapes, applied
/// to one axis or one side independently. A JSON array, empty if none yet.
#[tauri::command]
fn load_styles() -> Value {
    fs::read_to_string(dir().join("hotas_curve_styles.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_array())
        .unwrap_or_else(|| Value::Array(vec![]))
}

#[tauri::command]
async fn save_styles(styles: Value) -> Result<(), String> {
    if !styles.is_array() {
        return Err("styles must be a list".into());
    }
    let json = serde_json::to_string_pretty(&styles).map_err(|e| e.to_string())?;
    atomic_write("hotas_curve_styles.json", json.as_bytes())
}

/*
  WARDOGS's own bindings. The curves only reach the game through "Thrustmaster
  Combined"; an action bound to the physical Sol-R bypasses them completely.
  That happens silently whenever an axis is rebound inside the game: both
  devices move at once and the game takes the physical one, which moves first
  (and inside a deadzone, alone). So the editor watches the game's settings
  and offers to move those bindings over.
*/
const PHYSICAL: &str = "044F:0422:Sol-R [R] Flightstick";
/// The Sol-R 6 Throttle, which the script now drives too: T.A.R.G.E.T. hides
/// it from Windows, so bindings on it go dead unless they move to Combined.
const THROTTLE_DEV: &str = "044F:0447:Sol-R 6 Throttle";
const COMBINED: &str = "044F:FFFF:Thrustmaster Combined";

/*
  Where the throttle's inputs land in Combined (hotas_wardogs_solr.tmc):
  buttons and hats move up by 44, after the stick's; its lever is Z (axis 2
  either way), its twist RZ -> Combined's slider (axis 7), its thumbwheel ->
  Combined's throttle axis (6). The game counts axes and buttons from 0.
*/
const THROTTLE_BUTTON_SHIFT: i64 = 44;
fn throttle_axis_in_combined(raw: i64) -> Option<i64> {
    match raw {
        2 => Some(2), // TTHR, the lever -> DX_Z
        5 => Some(7), // TROCKER, the twist -> DX_SLIDER
        _ => None,    // the throttle's mini-stick etc. aren't passed on
    }
}

/// Rewrite one settings line from the throttle to Combined, renumbering what
/// it points at. None when the line can't be moved (an input not passed on).
fn move_throttle_line(line: &str) -> Option<String> {
    let key = format!("DeviceIdentifier=\"{THROTTLE_DEV}\",");
    let at = line.find(&key)?;
    let rest = &line[at + key.len()..];
    let eq = rest.find('=')?;
    let field = &rest[..eq];
    let digits: String = rest[eq + 1..].chars().take_while(|c| c.is_ascii_digit() || *c == '-').collect();
    let n: i64 = digits.parse().ok()?;
    let to = if line.trim_start().starts_with("ActionBindings=") {
        if n < 0 { return None; }
        n + THROTTLE_BUTTON_SHIFT
    } else {
        throttle_axis_in_combined(n)?
    };
    let tail = &rest[eq + 1 + digits.len()..];
    Some(format!("{}DeviceIdentifier=\"{COMBINED}\",{field}={to}{tail}", &line[..at]))
}
const GAME_EXE: &str = "WardogsClient-Win64-Shipping.exe";

fn game_ini() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let p = PathBuf::from(local).join(r"Wardogs\Saved\Config\WindowsClient\GameUserSettings.ini");
    p.exists().then_some(p)
}

fn game_running() -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {GAME_EXE}"), "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains(GAME_EXE))
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    false
}

/// Actions in a GameUserSettings.ini that read the physical stick.
fn physical_actions(ini: &str) -> Vec<String> {
    ini.lines()
        .filter(|l| l.contains(PHYSICAL) || l.contains(THROTTLE_DEV))
        .map(|l| match l.find("Action=") {
            // ActionBindings=(Action=Fire,Binding=(...))
            Some(i) => l[i + 7..].split(|c| c == ',' || c == ')').next().unwrap_or("?").to_string(),
            // Roll=(DeviceIdentifier="...",...)
            None => l.split('=').next().unwrap_or("?").to_string(),
        })
        .collect()
}

#[derive(Serialize)]
struct GameBindings {
    found: bool,
    running: bool,
    physical: Vec<String>,
}

#[tauri::command]
async fn game_bindings() -> Result<GameBindings, String> {
    blocking(|| {
        let Some(p) = game_ini() else {
            return GameBindings { found: false, running: false, physical: vec![] };
        };
        let ini = fs::read_to_string(&p).unwrap_or_default();
        GameBindings { found: true, running: game_running(), physical: physical_actions(&ini) }
    })
    .await
}

/// Move every binding on the physical stick or throttle to Thrustmaster
/// Combined. The stick's numbers stay as they are (the script passes them
/// 1:1); the throttle's are renumbered to where the script puts them.
#[tauri::command]
async fn fix_game_bindings() -> Result<usize, String> {
    blocking(fix_game_bindings_now).await?
}

fn fix_game_bindings_now() -> Result<usize, String> {
    let p = game_ini().ok_or("WARDOGS settings file not found")?;
    if game_running() {
        return Err("Close WARDOGS first - it rewrites its settings when it exits".into());
    }
    let ini = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let (fixed, n) = fix_bindings(&ini);
    if n == 0 {
        return Ok(0);
    }
    fs::copy(&p, p.with_file_name("GameUserSettings.before_solr_fix.ini")).map_err(|e| e.to_string())?;
    fs::write(&p, fixed).map_err(|e| e.to_string())?;
    Ok(n)
}

/// The settings with every stick and throttle binding moved to Combined, and
/// how many moved. Lines keep their own line endings.
fn fix_bindings(ini: &str) -> (String, usize) {
    let mut n = 0;
    let out: Vec<String> = ini
        .split_inclusive('\n')
        .map(|l| {
            if l.contains(PHYSICAL) {
                n += 1;
                l.replace(PHYSICAL, COMBINED)
            } else if l.contains(THROTTLE_DEV) {
                match move_throttle_line(l) {
                    Some(m) => {
                        n += 1;
                        m
                    }
                    None => l.to_string(),
                }
            } else {
                l.to_string()
            }
        })
        .collect();
    (out.concat(), n)
}

/*
  The in-game overlay: a second window showing the three curves and the live
  stick, pinned to the top-left of the primary monitor.

  - always on top, no frame, transparent, not in the taskbar
  - click-through (ignores the mouse), and never takes focus, so the game
    keeps every click and key
  - it reads the stick itself (Gamepad API) and gets curve changes from the
    editor as `solr:curves` events, so it keeps working with the editor
    minimised

  Visible over WARDOGS in windowed fullscreen (borderless), which is how it is
  set; exclusive fullscreen would hide any window, overlays included.
*/
const OVERLAY: &str = "overlay";
const MARGIN: f64 = 12.0;

// async on purpose: creating a window from a synchronous command deadlocks on
// Windows (the window comes up as a blank about:blank and the call never returns)
#[tauri::command]
async fn set_overlay(app: AppHandle, on: bool, width: f64, height: f64) -> Result<(), String> {
    let existing = app.get_webview_window(OVERLAY);
    if !on {
        if let Some(w) = existing {
            w.close().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    // top-left of the primary monitor, in logical pixels
    let (x, y) = match app.primary_monitor().map_err(|e| e.to_string())? {
        Some(m) => {
            let s = m.scale_factor();
            (m.position().x as f64 / s + MARGIN, m.position().y as f64 / s + MARGIN)
        }
        None => (MARGIN, MARGIN),
    };
    let w = match existing {
        Some(w) => {
            w.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
            w
        }
        None => WebviewWindowBuilder::new(&app, OVERLAY, WebviewUrl::App("index.html#overlay".into()))
            .title("Sol-R Curves overlay")
            .inner_size(width, height)
            .position(x, y)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .focused(false)
            .build()
            .map_err(|e| e.to_string())?,
    };
    w.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    w.set_always_on_top(true).map_err(|e| e.to_string())?;
    w.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    Ok(())
}

// ---- the T.A.R.G.E.T. script, run from here (see target.rs)

#[tauri::command]
async fn target_status(app: AppHandle) -> Result<target::Status, String> {
    blocking(move || target::status(&app, &dir())).await
}

#[tauri::command]
async fn target_start(app: AppHandle) -> Result<(), String> {
    blocking(move || target::start(&app, &dir())).await?
}

#[tauri::command]
async fn target_stop(app: AppHandle) -> Result<(), String> {
    blocking(move || target::stop(&app)).await?
}

/// Start Thrustmaster's service (Windows asks for admin approval).
#[tauri::command]
async fn target_start_service() -> Result<(), String> {
    blocking(target::start_service).await?
}

#[tauri::command]
fn target_log() -> Vec<target::LogLine> {
    target::log()
}

// ---- writing any script: .tmc files next to the curve files

#[derive(Serialize)]
struct ScriptFile {
    name: String,
    path: String,
    builtin: bool,
}

/// Only plain .tmc/.tmh names inside the curve folder: the editor can't be
/// pointed at arbitrary files on the disk.
fn script_path(name: &str) -> Result<PathBuf, String> {
    let ok = !name.is_empty()
        && !name.contains(['/', '\\', ':'])
        && !name.contains("..")
        && (name.to_lowercase().ends_with(".tmc") || name.to_lowercase().ends_with(".tmh"));
    if !ok {
        return Err(format!("\"{name}\" isn't a script name (letters, then .tmc)"));
    }
    Ok(dir().join(name))
}

#[tauri::command]
fn scripts_list() -> Vec<ScriptFile> {
    let mut v: Vec<ScriptFile> = fs::read_dir(dir())
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| {
                    let name = e.file_name().to_string_lossy().into_owned();
                    let l = name.to_lowercase();
                    (l.ends_with(".tmc") || l.ends_with(".tmh")).then(|| ScriptFile {
                        builtin: name == target::SCRIPT_NAME,
                        path: e.path().to_string_lossy().replace('\\', "/"),
                        name,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    if !v.iter().any(|s| s.builtin) {
        v.push(ScriptFile {
            name: target::SCRIPT_NAME.into(),
            path: dir().join(target::SCRIPT_NAME).to_string_lossy().replace('\\', "/"),
            builtin: true,
        });
    }
    v.sort_by(|a, b| b.builtin.cmp(&a.builtin).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    v
}

#[tauri::command]
fn script_read(name: String) -> Result<String, String> {
    if name == target::SCRIPT_NAME {
        return Ok(target::SCRIPT.replace("\r\n", "\n"));
    }
    fs::read_to_string(script_path(&name)?).map(|s| s.replace("\r\n", "\n")).map_err(|e| e.to_string())
}

#[tauri::command]
async fn script_write(name: String, text: String) -> Result<(), String> {
    if name == target::SCRIPT_NAME {
        return Err("The curve script is built into the app - duplicate it to edit".into());
    }
    let p = script_path(&name)?;
    let crlf = text.replace("\r\n", "\n").replace('\n', "\r\n");
    atomic_write(p.file_name().unwrap().to_str().unwrap(), crlf.as_bytes())
}

#[tauri::command]
async fn script_delete(name: String) -> Result<(), String> {
    if name == target::SCRIPT_NAME {
        return Err("The curve script is built into the app".into());
    }
    let p = script_path(&name)?;
    // never lost: renamed, not deleted
    fs::rename(&p, p.with_extension("tmc.deleted")).map_err(|e| e.to_string())
}

/// Compile (and optionally run) a script by name. Running one replaces the
/// curve script in the service: it holds one script at a time.
#[tauri::command]
async fn script_compile(app: AppHandle, name: String, run: bool) -> Result<target::CompileResult, String> {
    let p = if name == target::SCRIPT_NAME { target::install_builtin(&dir())? } else { script_path(&name)? };
    blocking(move || if run { target::compile_file(&app, &p, true) } else { target::check_file(&app, &p) }).await?
}

// ---- the stick's raw values through T.A.R.G.E.T.'s filter (hidraw.rs):
// works while a script hides it from Windows

#[tauri::command]
async fn raw_stick_start(app: AppHandle) -> Result<hidraw::RawStatus, String> {
    blocking(move || hidraw::start(&app)).await
}

#[tauri::command]
fn raw_stick_snapshot() -> Option<hidraw::RawStick> {
    hidraw::snapshot()
}

/// The Sol-R 6 Throttle's raw values (through T.A.R.G.E.T.'s filter), if connected.
#[tauri::command]
fn raw_throttle_snapshot() -> Option<hidraw::RawStick> {
    hidraw::snapshot_throttle()
}

/// Which throttle bank is on (0-based).
#[tauri::command]
fn throttle_bank() -> usize {
    thrbank::bank()
}

/// Put the throttle on another bank, as holding 48 / 49 does.
#[tauri::command]
fn set_throttle_bank(bank: usize) -> usize {
    thrbank::set_bank(bank)
}

/// Stop blinking the throttle bank LED while the LED mapping tool drives the LEDs.
#[tauri::command]
fn throttle_led_pause(on: bool) {
    thrbank::pause(on);
}

/// Horn Music (horn.rs): the instrument, a MIDI file, the render, playing it.
#[tauri::command]
fn horn_info() -> horn::HornInfo {
    horn::info()
}
#[tauri::command]
async fn horn_record(seconds: f32) -> Result<horn::HornInfo, String> {
    blocking(move || horn::record(seconds)).await?
}
#[tauri::command]
async fn horn_load_file(bytes: Vec<u8>, ext: String) -> Result<horn::HornInfo, String> {
    blocking(move || horn::load_file(bytes, ext)).await?
}
#[tauri::command]
fn horn_set_base(base: f32) -> horn::HornInfo {
    horn::set_base(base)
}
#[tauri::command]
async fn horn_midi(bytes: Vec<u8>) -> Result<horn::Song, String> {
    blocking(move || horn::parse_midi(&bytes)).await?
}
#[tauri::command]
async fn horn_render(notes: Vec<horn::Note>, transpose: i32, speed: f32) -> Result<horn::Rendered, String> {
    blocking(move || horn::render(notes, transpose, speed)).await?
}
#[tauri::command]
fn horn_play(game: bool) -> Result<(), String> {
    horn::play(game)
}
#[tauri::command]
fn horn_hear() -> Result<(), String> {
    horn::hear_horn()
}

/// Open a web page in the default browser (the Help page's download links).
/// Only https: nothing else gets handed to the shell.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || c == '"') {
        return Err("not a web address".into());
    }
    let mut c = std::process::Command::new("rundll32");
    c.args(["url.dll,FileProtocolHandler", &url]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c.spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// The RAM the app uses right now, WebView2 included.
#[tauri::command]
fn memory_usage() -> memory::Usage {
    memory::usage()
}

/// Voice control settings (`hotas_voice.json`): banks, LED colours, the LED map.
#[tauri::command]
fn voice_load() -> Value {
    fs::read_to_string(dir().join("hotas_voice.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_object())
        .unwrap_or(Value::Null)
}

#[tauri::command]
async fn voice_save(voice: Value) -> Result<(), String> {
    if !voice.is_object() {
        return Err("voice settings must be an object".into());
    }
    let json = serde_json::to_string_pretty(&voice).map_err(|e| e.to_string())?;
    atomic_write("hotas_voice.json", json.as_bytes())?;
    macros::set_config(&voice);
    thrbank::set_config(&voice);
    sound::set_config(voice);
    Ok(())
}

// ---- voice control sounds (sound.rs)

/// Where the clips go and how many are ready; None while the devices open.
#[tauri::command]
fn sound_status() -> Option<sound::SoundStatus> {
    sound::status()
}

/// The sound files in a folder, for picking what goes on each pad.
#[tauri::command]
async fn sound_files(folder: String) -> Result<Vec<String>, String> {
    blocking(move || sound::files(std::path::Path::new(&folder))).await?
}

/// Hear a clip yourself (monitor only - nothing goes out to the game).
#[tauri::command]
fn sound_preview(folder: String, file: String) {
    sound::preview(std::path::Path::new(&folder).join(file));
}

/// Check a macro's steps as typed: Ok(number of steps) or what's wrong.
#[tauri::command]
fn macro_check(steps: String) -> Result<usize, String> {
    macros::parse(&steps).map(|s| s.len())
}

/// While the Macros page is open, a button press only picks that button: it
/// must not type into the desktop or play into the game.
#[tauri::command]
fn stick_suppress(on: bool) {
    macros::suppress(on);
    if on {
        sound::stop();
    }
}

#[tauri::command]
fn sound_stop() {
    sound::stop();
}

/// Open the sound devices again (after installing VB-CABLE, replugging, ...).
#[tauri::command]
fn sound_reconnect() {
    sound::reopen();
}

/// Put the VB-CABLE device back from the driver Windows keeps (vbcable.rs),
/// then open the sound devices again. One admin prompt.
#[tauri::command]
async fn sound_repair_cable() -> Result<(), String> {
    blocking(vbcable::repair).await??;
    // Windows needs a moment to publish the new endpoint
    blocking(|| thread::sleep(Duration::from_millis(1500))).await?;
    sound::reopen();
    Ok(())
}

// ---- the Sol-R's RGB button LEDs (led.rs): [group, r, g, b] each

#[tauri::command]
async fn led_set(leds: Vec<(u32, u8, u8, u8)>) -> Result<(), String> {
    blocking(move || led::set(&leds)).await?
}

// ---- the physical devices (devices.rs)

#[tauri::command]
async fn devices_list(app: AppHandle) -> Result<Vec<devices::Device>, String> {
    blocking(move || devices::list(&app)).await?
}

#[tauri::command]
async fn device_set_led(app: AppHandle, serial: u32, flags: u8, intensity: u8) -> Result<(), String> {
    blocking(move || devices::set_led(&app, serial, flags, intensity)).await?
}

#[tauri::command]
async fn device_set_deadzone(app: AppHandle, serial: u32, on: bool) -> Result<(), String> {
    blocking(move || devices::set_deadzone(&app, serial, on)).await?
}

#[tauri::command]
async fn device_set_hid_enabled(app: AppHandle, serial: u32, enabled: bool) -> Result<bool, String> {
    blocking(move || devices::set_hid_enabled(&app, serial, enabled)).await?
}

/// Let go of everything outside the app before it goes: the raw feed, Caps
/// Lock and the sounds, and the T.A.R.G.E.T. script (the stick plain again).
fn release_all() {
    thrbank::shutdown();
    hidraw::shutdown();
    sound::shutdown();
    target::shutdown();
}

/// Bring the main window back from the tray, in front - built again if it
/// was closed (tray.rs: closing it is what frees its RAM).
fn show_main(app: &AppHandle) {
    let w = match app.get_webview_window("main") {
        Some(w) => w,
        None => {
            let Some(conf) = app.config().app.windows.first().cloned() else { return };
            match WebviewWindowBuilder::from_config(app, &conf).and_then(|b| b.build()) {
                Ok(w) => w,
                Err(_) => return,
            }
        }
    };
    tray::window_opened();
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
}

/// The tray icon: click it to open the window, right-click for Show / Quit.
/// Quit is the only way to close the app - the window's X hides it here.
fn tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    let show = MenuItem::with_id(app, "show", "Open Sol-R Curves", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Restart", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &PredefinedMenuItem::separator(app)?, &restart, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Sol-R Curves")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "show" => show_main(app),
            "restart" => {
                // the same tidy-up as quitting (script stopped, Caps Lock let go,
                // the stick handed back), then a fresh start of the app
                release_all();
                // let go of "the one copy" first, or the new one would find
                // this one still here and hand over to it instead of starting
                tauri_plugin_single_instance::destroy(app);
                app.restart();
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

pub fn run() {
    vbcable::run_if_asked(); // the elevated copy that repairs the cable, then exits
    migrate_from_e();
    tauri::Builder::default()
        // one copy: starting the app again (the shortcut, the .exe) opens the
        // window of the copy already in the tray instead of a second one
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            read_ack,
            load_presets,
            save_presets,
            load_styles,
            save_styles,
            set_overlay,
            game_bindings,
            fix_game_bindings,
            target_status,
            target_start,
            target_stop,
            target_log,
            target_start_service,
            scripts_list,
            script_read,
            script_write,
            script_delete,
            script_compile,
            devices_list,
            device_set_led,
            device_set_deadzone,
            device_set_hid_enabled,
            raw_stick_start,
            led_set,
            voice_load,
            voice_save,
            sound_status,
            sound_files,
            sound_preview,
            sound_stop,
            sound_reconnect,
            macro_check,
            stick_suppress,
            sound_repair_cable,
            raw_stick_snapshot,
            raw_throttle_snapshot,
            memory_usage,
            throttle_bank,
            set_throttle_bank,
            throttle_led_pause,
            open_url,
            horn_info,
            horn_record,
            horn_load_file,
            horn_set_base,
            horn_midi,
            horn_render,
            horn_play,
            horn_hear
        ])
        .on_window_event(|window, event| {
            if window.label() == "main" {
                // the X closes the window for real - its WebView2 and nearly
                // all the RAM go with it - but not the app: the script, the
                // sounds, the macros and the banks keep running from the tray
                // (tray.rs). Quit from the tray. The overlay stays if it's on.
                if let WindowEvent::Destroyed = event {
                    tray::window_closed(window.app_handle());
                }
            }
        })
        .setup(|app| {
            let voice = voice_load();
            macros::set_config(&voice);
            thrbank::start(app.handle(), &voice);
            tray::start(app.handle());
            sound::start(app.handle(), voice);
            tray(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Sol-R Curves")
        .run(|_app, event| match event {
            // the last window closing is no reason to go: only Quit (an exit
            // with a code) ends the app
            tauri::RunEvent::ExitRequested { code: None, api, .. } => api.prevent_exit(),
            // one app: when it goes, the script goes, and the stick is plain again
            tauri::RunEvent::Exit => release_all(),
            _ => {}
        });
}

#[cfg(test)]
mod bindings_tests {
    use super::*;

    #[test]
    fn throttle_bindings_move_to_combined_renumbered() {
        let ini = concat!(
            "Throttle=(DeviceIdentifier=\"044F:0447:Sol-R 6 Throttle\",_aaaajcpgpllhacnlfdnkg=2,bInvert=True,Positive=(DeviceIdentifier=\"\",_aaaaljahlggohoapfcfef=-1))\r\n",
            "ActionBindings=(Action=Horn,Binding=(DeviceIdentifier=\"044F:0447:Sol-R 6 Throttle\",_aaaaljahlggohoapfcfef=0))\r\n",
            "ActionBindings=(Action=DeploySupplyCrate,Binding=(DeviceIdentifier=\"044F:0447:Sol-R 6 Throttle\",_aaaaljahlggohoapfcfef=1))\r\n",
            "ActionBindings=(Action=Fire,Binding=(DeviceIdentifier=\"044F:0422:Sol-R [R] Flightstick\",_aaaaljahlggohoapfcfef=23))\r\n",
            "Other=1\r\n",
        );
        let (out, n) = fix_bindings(ini);
        assert_eq!(n, 4);
        assert!(out.contains("Throttle=(DeviceIdentifier=\"044F:FFFF:Thrustmaster Combined\",_aaaajcpgpllhacnlfdnkg=2,bInvert=True"), "{out}");
        assert!(out.contains("Action=Horn,Binding=(DeviceIdentifier=\"044F:FFFF:Thrustmaster Combined\",_aaaaljahlggohoapfcfef=44))"), "{out}");
        assert!(out.contains("Action=DeploySupplyCrate,Binding=(DeviceIdentifier=\"044F:FFFF:Thrustmaster Combined\",_aaaaljahlggohoapfcfef=45))"));
        assert!(out.contains("Action=Fire,Binding=(DeviceIdentifier=\"044F:FFFF:Thrustmaster Combined\",_aaaaljahlggohoapfcfef=23))"), "the stick keeps its numbers");
        assert!(!out.contains("0447"));
        assert!(out.ends_with("Other=1\r\n"), "the rest untouched, line endings kept");
        // the mini-stick (axis 0) isn't passed on by the script: left alone
        let (same, m) = fix_bindings("X=(DeviceIdentifier=\"044F:0447:Sol-R 6 Throttle\",_aaaajcpgpllhacnlfdnkg=0,b=1)\n");
        assert_eq!(m, 0);
        assert!(same.contains("0447"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The file must parse the way the .tmc's NextInt()/Poll() parse it.
    #[test]
    fn table_file_matches_the_script_format() {
        let d = std::env::temp_dir().join("solr-curves-test");
        fs::create_dir_all(&d).unwrap();
        std::env::set_var("SOLR_DIR", &d);
        let table: Vec<i64> = (0..NTAB as i64).map(|i| (i % 257) * 255 - 32640).collect();
        tauri::async_runtime::block_on(save_state(
            serde_json::json!({ "x": 1 }),
            table.clone(),
            123456,
            "19 Sep 2026  10:00:00  |  Roll: curve 2 -> 3 \u{2192}".into(),
        ))
        .unwrap();
        let txt = fs::read_to_string(d.join("hotas_curves.txt")).unwrap();

        // port of NextInt(): skip to a digit or '-', read the number
        let bytes = txt.as_bytes();
        let mut pos = 0;
        let mut next = || -> Option<i64> {
            while pos < bytes.len() && bytes[pos] != b'-' && !bytes[pos].is_ascii_digit() {
                pos += 1;
            }
            if pos >= bytes.len() {
                return None;
            }
            let neg = bytes[pos] == b'-';
            if neg {
                pos += 1;
            }
            let mut v = 0i64;
            while pos < bytes.len() && bytes[pos].is_ascii_digit() {
                v = v * 10 + (bytes[pos] - b'0') as i64;
                pos += 1;
            }
            Some(if neg { -v } else { v })
        };
        assert_eq!(next(), Some(123456));
        let read: Vec<i64> = (0..NTAB).map(|_| next().unwrap()).collect();
        assert_eq!(read, table);
        assert_eq!(next(), Some(123456));
        let note = txt.split('#').nth(1).unwrap().trim_end();
        assert_eq!(note, "19 Sep 2026  10:00:00  |  Roll: curve 2 -> 3 ?");
        assert!(bad_table_rejected());
    }

    /// The script holds the table open (shared for read/write, not for
    /// delete - like the C runtime's fopen), so replacing it fails. The write
    /// must still land, in place.
    #[test]
    #[cfg(windows)]
    fn write_lands_while_the_script_holds_the_file() {
        use std::os::windows::fs::OpenOptionsExt;
        // its own folder, passed in: other tests set SOLR_DIR in parallel
        let d = std::env::temp_dir().join("solr-curves-lock-test");
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("locked.txt"), b"old").unwrap();
        let held = fs::OpenOptions::new()
            .read(true)
            .share_mode(1 | 2) // FILE_SHARE_READ | FILE_SHARE_WRITE, no FILE_SHARE_DELETE
            .open(d.join("locked.txt"))
            .unwrap();
        atomic_write_in(&d, "locked.txt", b"new table").unwrap();
        drop(held);
        assert_eq!(fs::read(d.join("locked.txt")).unwrap(), b"new table");
        assert!(!d.join("locked.txt.tmp").exists(), "no stray .tmp left behind");
    }

    /// The exact lines found in the user's GameUserSettings.ini.
    #[test]
    fn finds_physical_bindings() {
        let ini = [
            r#"Pitch=(DeviceIdentifier="044F:FFFF:Thrustmaster Combined",_x=1,bInvert=False)"#,
            r#"Roll=(DeviceIdentifier="044F:0422:Sol-R [R] Flightstick",_x=0,bInvert=False)"#,
            r#"Yaw=(DeviceIdentifier="044F:0422:Sol-R [R] Flightstick",_x=5,bInvert=False)"#,
            r#"Throttle=(DeviceIdentifier="044F:0447:Sol-R 6 Throttle",_x=2,bInvert=True)"#,
            r#"ActionBindings=(Action=Flares,Binding=(DeviceIdentifier="044F:0422:Sol-R [R] Flightstick",_y=25))"#,
        ]
        .join("\r\n");
        // the throttle counts now: the script drives it, so T.A.R.G.E.T. hides it
        assert_eq!(physical_actions(&ini), vec!["Roll", "Yaw", "Throttle", "Flares"]);
    }

    fn bad_table_rejected() -> bool {
        tauri::async_runtime::block_on(save_state(Value::Null, vec![0; 10], 1, String::new())).is_err()
    }
}
