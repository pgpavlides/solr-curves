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

/// One step as run: `fast` steps follow each other after FAST_GAP instead of
/// the macro's gap (and hold their key shorter) - "Enter x24 fast".
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Timed {
    pub step: Step,
    pub fast: bool,
}

const FAST_GAP: u64 = 45;
const FAST_HOLD: u64 = 20;
const HOLD: u64 = 40;

fn one(word: &str) -> Result<Step, String> {
    let key = word.replace([' ', '_'], "").to_ascii_lowercase();
    Ok(match key.as_str() {
        "wheeldown" | "scrolldown" => Step::Wheel(-1),
        "wheelup" | "scrollup" => Step::Wheel(1),
        k if k.starts_with("wait") => Step::Wait(k[4..].trim_end_matches("ms").parse().map_err(|_| format!("\"{word}\": Wait needs ms, e.g. Wait 200"))?),
        _ => scan(&key).map(|(s, e)| Step::Key(s, e)).ok_or_else(|| format!("\"{word}\" isn't a key I know"))?,
    })
}

/// "F, WheelDown, WheelDown, F, Esc" - steps separated by commas, arrows (->)
/// or " - ". A step can repeat and go fast: "Enter x24 fast", "24 times Enter
/// fast", "24x Enter". "Down arrow" is just Down.
pub fn parse(text: &str) -> Result<Vec<Timed>, String> {
    let mut out = vec![];
    let cleaned = text.replace("-->", ",").replace("->", ",").replace(" - ", ",").replace('>', ",");
    for part in cleaned.split([',', ';']).map(str::trim).filter(|s| !s.is_empty()) {
        let mut count = 1usize;
        let mut fast = false;
        let mut name: Vec<&str> = vec![];
        for w in part.split_whitespace() {
            let l = w.to_ascii_lowercase();
            let num = l.trim_start_matches('x').trim_end_matches('x').trim_end_matches("times");
            if l == "fast" {
                fast = true;
            } else if l == "times" || l == "time" || l == "arrow" || l == "key" {
            } else if !l.starts_with("wait") && (l.starts_with('x') || l.ends_with('x') || name.is_empty() || l.ends_with("times")) && !num.is_empty() && num.chars().all(|c| c.is_ascii_digit()) && !(name.first().is_some_and(|n| n.eq_ignore_ascii_case("wait"))) {
                count = num.parse().map_err(|_| format!("\"{part}\": bad count"))?;
            } else {
                name.push(w);
            }
        }
        if name.is_empty() && !part.contains(char::is_whitespace) {
            // a lone "5" is the 5 key, not a count
            name.push(part);
            count = 1;
        }
        if name.is_empty() {
            return Err(format!("\"{part}\": which key?"));
        }
        if count == 0 || count > 200 {
            return Err(format!("\"{part}\": 1 to 200 times"));
        }
        let step = one(&name.join(" "))?;
        for _ in 0..count {
            out.push(Timed { step, fast });
        }
    }
    Ok(out)
}

#[cfg(windows)]
fn send(step: Step, fast: bool) {
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
            std::thread::sleep(Duration::from_millis(if fast { FAST_HOLD } else { HOLD }));
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
                let fast = s.fast && steps[i - 1].fast;
                std::thread::sleep(Duration::from_millis(if fast { FAST_GAP } else { gap }));
            }
            #[cfg(windows)]
            send(s.step, s.fast);
        }
        if let Some(set) = RUNNING.lock().unwrap().as_mut() {
            set.remove(&button);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn steps(text: &str) -> Vec<Step> {
        parse(text).unwrap().into_iter().map(|t| t.step).collect()
    }

    #[test]
    fn reads_the_sequence_as_written() {
        let f = Step::Key(0x21, false);
        assert_eq!(steps("F-->SCROLL DOWN-->SCROLL DOWN-->F-->ESC"), vec![f, Step::Wheel(-1), Step::Wheel(-1), f, Step::Key(0x01, false)]);
        assert_eq!(steps("f, wheelup, wait 250, F5, Up"), vec![f, Step::Wheel(1), Step::Wait(250), Step::Key(0x3F, false), Step::Key(0x48, true)]);
        assert!(parse("F, Banana").is_err());
    }

    #[test]
    fn repeats_and_fast() {
        let enter = Step::Key(0x1C, false);
        // button 12, as asked for
        let t = parse("B - DOWN ARROW - DOWN, UP - ENTER - ENTER - F - F - RIGHT ARROW - 24 TIMES ENTER FAST").unwrap();
        assert_eq!(t.len(), 9 + 24);
        assert_eq!(t[1].step, Step::Key(0x50, true));
        assert_eq!(t[8].step, Step::Key(0x4D, true));
        assert!(t[9..].iter().all(|x| x.step == enter && x.fast));
        assert!(!t[..9].iter().any(|x| x.fast));
        assert_eq!(parse("Enter x24 fast").unwrap().len(), 24);
        assert_eq!(parse("24x Enter").unwrap().len(), 24);
        assert_eq!(steps("Wait 300"), vec![Step::Wait(300)]);
        assert_eq!(steps("F5"), vec![Step::Key(0x3F, false)]);
        assert_eq!(steps("5"), vec![Step::Key(0x06, false)], "a lone digit is the key");
    }
}
