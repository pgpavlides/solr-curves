//! The bridge between the curve editor and T.A.R.G.E.T.
//!
//! Three files, all next to the .tmc script (E:\ unless SOLR_DIR says otherwise):
//!
//! - `hotas_curves.json`  the app's own state (what the sliders were)
//! - `hotas_curves.txt`   the lookup tables the script reads, plus a log line
//! - `hotas_curves.ack`   written BY THE SCRIPT: the table number it loaded.
//!                        The only proof a change reached T.A.R.G.E.T.
//!
//! This replaces the dev-server middleware in vite.config.ts, which stays for
//! running the UI in a plain browser (and for the browser tests). Both must
//! write the table in exactly the same format.

mod devices;
mod hidraw;
mod target;
mod tmsc;

use serde::Serialize;
use serde_json::Value;
use std::{fs, path::PathBuf, thread, time::Duration};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const NTAB: usize = 3 * 257;
const AMAX: i32 = 32767;

fn dir() -> PathBuf {
    PathBuf::from(std::env::var("SOLR_DIR").unwrap_or_else(|_| "E:/".into()))
}

/*
  Write to a temp file and rename over the target, so the script never sees a
  half-written table. The rename fails while the script has the file open (it
  does, briefly, four times a second), hence the retries. The table number at
  both ends of the file is the script's second line of defence.
*/
fn atomic_write(name: &str, data: &[u8]) -> Result<(), String> {
    let file = dir().join(name);
    let tmp = dir().join(format!("{name}.tmp"));
    fs::write(&tmp, data).map_err(|e| format!("write {}: {e}", tmp.display()))?;
    let mut tries = 0;
    loop {
        match fs::rename(&tmp, &file) {
            Ok(()) => return Ok(()),
            Err(e) if tries >= 20 => return Err(format!("replace {}: {e}", file.display())),
            Err(_) => {
                tries += 1;
                thread::sleep(Duration::from_millis(25));
            }
        }
    }
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

/*
  WARDOGS's own bindings. The curves only reach the game through "Thrustmaster
  Combined"; an action bound to the physical Sol-R bypasses them completely.
  That happens silently whenever an axis is rebound inside the game: both
  devices move at once and the game takes the physical one, which moves first
  (and inside a deadzone, alone). So the editor watches the game's settings
  and offers to move those bindings over.
*/
const PHYSICAL: &str = "044F:0422:Sol-R [R] Flightstick";
const COMBINED: &str = "044F:FFFF:Thrustmaster Combined";
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
        .filter(|l| l.contains(PHYSICAL))
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
async fn game_bindings() -> GameBindings {
    let Some(p) = game_ini() else {
        return GameBindings { found: false, running: false, physical: vec![] };
    };
    let ini = fs::read_to_string(&p).unwrap_or_default();
    GameBindings { found: true, running: game_running(), physical: physical_actions(&ini) }
}

/// Move every physical-stick binding to Thrustmaster Combined. Axis and button
/// numbers stay the same: the script passes both through 1:1.
#[tauri::command]
async fn fix_game_bindings() -> Result<usize, String> {
    let p = game_ini().ok_or("WARDOGS settings file not found")?;
    if game_running() {
        return Err("Close WARDOGS first - it rewrites its settings when it exits".into());
    }
    let ini = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let n = ini.matches(PHYSICAL).count();
    if n == 0 {
        return Ok(0);
    }
    fs::copy(&p, p.with_file_name("GameUserSettings.before_solr_fix.ini")).map_err(|e| e.to_string())?;
    fs::write(&p, ini.replace(PHYSICAL, COMBINED)).map_err(|e| e.to_string())?;
    Ok(n)
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
async fn target_status(app: AppHandle) -> target::Status {
    target::status(&app, &dir())
}

#[tauri::command]
async fn target_start(app: AppHandle) -> Result<(), String> {
    target::start(&app, &dir())
}

#[tauri::command]
async fn target_stop(app: AppHandle) -> Result<(), String> {
    target::stop(&app)
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
    if run { target::compile_file(&app, &p, true) } else { target::check_file(&app, &p) }
}

// ---- the stick's raw values through T.A.R.G.E.T.'s filter (hidraw.rs):
// works while a script hides it from Windows

#[tauri::command]
async fn raw_stick_start(app: AppHandle) -> hidraw::RawStatus {
    hidraw::start(&app)
}

#[tauri::command]
fn raw_stick_snapshot() -> Option<hidraw::RawStick> {
    hidraw::snapshot()
}

// ---- the physical devices (devices.rs)

#[tauri::command]
async fn devices_list(app: AppHandle) -> Result<Vec<devices::Device>, String> {
    devices::list(&app)
}

#[tauri::command]
async fn device_set_led(app: AppHandle, serial: u32, flags: u8, intensity: u8) -> Result<(), String> {
    devices::set_led(&app, serial, flags, intensity)
}

#[tauri::command]
async fn device_set_deadzone(app: AppHandle, serial: u32, on: bool) -> Result<(), String> {
    devices::set_deadzone(&app, serial, on)
}

#[tauri::command]
async fn device_set_hid_enabled(app: AppHandle, serial: u32, enabled: bool) -> Result<bool, String> {
    devices::set_hid_enabled(&app, serial, enabled)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            read_ack,
            load_presets,
            save_presets,
            set_overlay,
            game_bindings,
            fix_game_bindings,
            target_status,
            target_start,
            target_stop,
            target_log,
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
            raw_stick_snapshot
        ])
        // the overlay has no close button: it goes when the editor goes
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::Destroyed = event {
                    window.app_handle().exit(0);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Sol-R Curves")
        .run(|_app, event| {
            // one app: when it goes, the script goes, and the stick is plain again
            if let tauri::RunEvent::Exit = event {
                hidraw::shutdown();
                target::shutdown();
            }
        });
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
        assert_eq!(physical_actions(&ini), vec!["Roll", "Yaw", "Flares"]);
    }

    fn bad_table_rejected() -> bool {
        tauri::async_runtime::block_on(save_state(Value::Null, vec![0; 10], 1, String::new())).is_err()
    }
}
