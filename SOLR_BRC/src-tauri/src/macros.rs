//! Button macros: a stick button types a sequence of keys and mouse-wheel
//! steps into the game, e.g. button 1 = "F, WheelDown, WheelDown, F, Esc".
//!
//! T.A.R.G.E.T. can't do this itself - it has no mouse wheel - so the app
//! sends them (SendInput, keys as scan codes like ptt.rs). Each macro runs on
//! its own thread, a step every `gap` ms; pressing the button again while it
//! runs does nothing, so a bouncy press can't start it twice.
//!
//! Setup lives in hotas_voice.json:
//!   "macros": { "1": { "steps": "F, WheelDown, WheelDown, F, Esc", "gap": 120 } }

use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub enum Step {
    /// A key tap: scan code, extended (E0) or not.
    Key(u16, bool),
    /// Mouse wheel notches: negative = down (towards you), positive = up.
    Wheel(i32),
    /// An extra pause, ms ("Wait 300").
    Wait(u32),
}

static CONFIG: Mutex<Value> = Mutex::new(Value::Null);
static RUNNING: Mutex<Option<HashSet<u16>>> = Mutex::new(None);

/// Scan codes (set 1, as SendInput wants them) for a key name.
fn scan(name: &str) -> Option<(u16, bool)> {
    let n = name.to_ascii_lowercase();
    const LETTERS: &[(char, u16)] = &[
        ('q', 0x10), ('w', 0x11), ('e', 0x12), ('r', 0x13), ('t', 0x14), ('y', 0x15), ('u', 0x16), ('i', 0x17), ('o', 0x18), ('p', 0x19),
        ('a', 0x1E), ('s', 0x1F), ('d', 0x20), ('f', 0x21), ('g', 0x22), ('h', 0x23), ('j', 0x24), ('k', 0x25), ('l', 0x26),
        ('z', 0x2C), ('x', 0x2D), ('c', 0x2E), ('v', 0x2F), ('b', 0x30), ('n', 0x31), ('m', 0x32),
        ('1', 0x02), ('2', 0x03), ('3', 0x04), ('4', 0x05), ('5', 0x06), ('6', 0x07), ('7', 0x08), ('8', 0x09), ('9', 0x0A), ('0', 0x0B),
    ];
    if n.chars().count() == 1 {
        let c = n.chars().next()?;
        return LETTERS.iter().find(|(k, _)| *k == c).map(|(_, s)| (*s, false));
    }
    if let Some(f) = n.strip_prefix('f').and_then(|x| x.parse::<u16>().ok()) {
        return match f {
            1..=10 => Some((0x3B + f - 1, false)),
            11 => Some((0x57, false)),
            12 => Some((0x58, false)),
            _ => None,
        };
    }
    Some(match n.as_str() {
        "esc" | "escape" => (0x01, false),
        "enter" | "return" => (0x1C, false),
        "space" => (0x39, false),
        "tab" => (0x0F, false),
        "backspace" => (0x0E, false),
        "shift" => (0x2A, false),
        "ctrl" | "control" => (0x1D, false),
        "alt" => (0x38, false),
        "capslock" | "caps" => (0x3A, false),
        "up" => (0x48, true),
        "down" => (0x50, true),
        "left" => (0x4B, true),
        "right" => (0x4D, true),
        "home" => (0x47, true),
        "end" => (0x4F, true),
        "pageup" => (0x49, true),
        "pagedown" => (0x51, true),
        "insert" => (0x52, true),
        "delete" => (0x53, true),
        _ => return None,
    })
}

/// "F, WheelDown, WheelDown, F, Esc" (commas, arrows or spaces between steps).
pub fn parse(text: &str) -> Result<Vec<Step>, String> {
    let mut out = vec![];
    let cleaned = text.replace("-->", ",").replace("->", ",").replace('>', ",");
    let mut words = cleaned.split([',', ';']).map(str::trim).filter(|s| !s.is_empty()).peekable();
    while let Some(w) = words.next() {
        let key = w.replace([' ', '_'], "").to_ascii_lowercase();
        let step = match key.as_str() {
            "wheeldown" | "scrolldown" => Step::Wheel(-1),
            "wheelup" | "scrollup" => Step::Wheel(1),
            k if k.starts_with("wait") => Step::Wait(k[4..].trim_end_matches("ms").parse().map_err(|_| format!("\"{w}\": Wait needs ms, e.g. Wait 200"))?),
            _ => scan(&key).map(|(s, e)| Step::Key(s, e)).ok_or_else(|| format!("\"{w}\" isn't a key I know"))?,
        };
        out.push(step);
    }
    Ok(out)
}

#[cfg(windows)]
fn send(step: Step) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
    let key = |scan: u16, ext: bool, up: bool| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: 0,
                wScan: scan,
                dwFlags: KEYEVENTF_SCANCODE | if ext { KEYEVENTF_EXTENDEDKEY } else { 0 } | if up { KEYEVENTF_KEYUP } else { 0 },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let one = |i: INPUT| unsafe { SendInput(1, &i, std::mem::size_of::<INPUT>() as i32) };
    match step {
        Step::Key(s, e) => {
            one(key(s, e, false));
            // held briefly: games polling the keyboard miss a zero-length tap
            std::thread::sleep(Duration::from_millis(40));
            one(key(s, e, true));
        }
        Step::Wheel(n) => {
            one(INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: (n * 120) as u32, dwFlags: MOUSEEVENTF_WHEEL, time: 0, dwExtraInfo: 0 },
                },
            });
        }
        Step::Wait(ms) => std::thread::sleep(Duration::from_millis(ms as u64)),
    }
}

pub fn set_config(voice: &Value) {
    *CONFIG.lock().unwrap() = voice.get("macros").cloned().unwrap_or(Value::Null);
}

/// From the stick's callback: start the button's macro, if it has one.
pub fn press(button: u16) {
    let (steps, gap) = {
        let cfg = CONFIG.lock().unwrap();
        let Some(m) = cfg.get(button.to_string()) else { return };
        let Ok(steps) = parse(m.get("steps").and_then(|s| s.as_str()).unwrap_or("")) else { return };
        let gap = m.get("gap").and_then(|g| g.as_u64()).unwrap_or(120).clamp(10, 5000);
        (steps, gap)
    };
    if steps.is_empty() {
        return;
    }
    {
        let mut running = RUNNING.lock().unwrap();
        let set = running.get_or_insert_with(HashSet::new);
        if !set.insert(button) {
            return; // already running
        }
    }
    std::thread::spawn(move || {
        for (i, s) in steps.iter().enumerate() {
            if i > 0 {
                std::thread::sleep(Duration::from_millis(gap));
            }
            #[cfg(windows)]
            send(*s);
        }
        if let Some(set) = RUNNING.lock().unwrap().as_mut() {
            set.remove(&button);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_sequence_as_written() {
        let s = parse("F-->SCROLL DOWN-->SCROLL DOWN-->F-->ESC").unwrap();
        assert_eq!(s, vec![Step::Key(0x21, false), Step::Wheel(-1), Step::Wheel(-1), Step::Key(0x21, false), Step::Key(0x01, false)]);
        assert_eq!(parse("f, wheelup, wait 250, F5, Up").unwrap(), vec![Step::Key(0x21, false), Step::Wheel(1), Step::Wait(250), Step::Key(0x3F, false), Step::Key(0x48, true)]);
        assert!(parse("F, Banana").is_err());
    }
}
