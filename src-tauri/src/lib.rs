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

use serde::Serialize;
use serde_json::Value;
use std::{fs, path::PathBuf, thread, time::Duration};

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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_state, save_state, read_ack, load_presets, save_presets])
        .run(tauri::generate_context!())
        .expect("error while running Sol-R Curves");
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

    fn bad_table_rejected() -> bool {
        tauri::async_runtime::block_on(save_state(Value::Null, vec![0; 10], 1, String::new())).is_err()
    }
}
