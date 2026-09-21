//! Tray mode: the window's X closes the window for real, so its WebView2
//! processes (nearly all of the app's RAM) go with it; the tray's Open builds
//! it again. What the window did while it was open, the backend does while it
//! is closed:
//!
//!   - keep the raw stick / throttle feed running (sounds, macros, banks);
//!   - paint the knob's bank colour on the stick's LEDs when the knob turns;
//!   - start the curve script again if Thrustmaster's service restarted it
//!     away (only if it was running when the window closed).

use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::AppHandle;

static WINDOW_OPEN: AtomicBool = AtomicBool::new(true);
/// the script was running when the window closed: keep it running
static SCRIPT_WANTED: AtomicBool = AtomicBool::new(false);
/// repaint the LEDs on the next tick (the window just closed)
static REPAINT: AtomicBool = AtomicBool::new(false);

/// Pad button -> LED group, as measured on the stick (voice.ts SOLR_LED_MAP).
const PADS: [(u16, u32); 8] = [(5, 0), (6, 1), (7, 2), (8, 3), (16, 5), (17, 4), (18, 7), (19, 6)];
const ALL_GROUPS: u32 = 64;
/// All eight pads at once - the same LEDs as their own groups, last write wins
/// (voice.ts PADS_ALL_GROUP): never sent, and the pads go last.
const PADS_ALL_GROUP: u32 = 30;

pub fn window_closed(app: &AppHandle) {
    WINDOW_OPEN.store(false, Ordering::Relaxed);
    REPAINT.store(true, Ordering::Relaxed);
    let app = app.clone();
    std::thread::spawn(move || {
        let running = crate::target::status(&app, &crate::dir()).running;
        SCRIPT_WANTED.store(running, Ordering::Relaxed);
    });
}

pub fn window_opened() {
    WINDOW_OPEN.store(true, Ordering::Relaxed);
}

pub fn window_open() -> bool {
    WINDOW_OPEN.load(Ordering::Relaxed)
}

/// The stick as a bank should look - the same rule as voice.ts bankLeds:
/// everything in the bank's colour, pads without a sound dark, and the
/// throttle's blinking LED left to thrbank.rs.
fn bank_leds(cfg: &Value, bank: usize) -> Vec<(u32, u8, u8, u8)> {
    let b = &cfg["banks"][bank];
    let (r, g, bl) = crate::thrbank::rgb(b["color"].as_str().unwrap_or("#ffffff"));
    let mut out: Vec<(u32, u8, u8, u8)> = (0..ALL_GROUPS).map(|i| (i, r, g, bl)).collect();
    for (button, default) in PADS {
        let key = button.to_string();
        let group = cfg["map"][&key].as_u64().map_or(default, |v| v as u32);
        let has_sound = b["pads"][&key].as_str().is_some_and(|f| !f.is_empty());
        if !has_sound && (group as usize) < out.len() {
            out[group as usize] = (group, 0, 0, 0);
        }
    }
    let skip = cfg["throttleLed"].as_u64().map(|v| v as u32);
    out.retain(|(i, ..)| Some(*i) != skip && *i != PADS_ALL_GROUP);
    // the pads last, so nothing written after them can change them
    let pad_groups: Vec<u32> = PADS.iter().map(|(button, default)| cfg["map"][&button.to_string()].as_u64().map_or(*default, |v| v as u32)).collect();
    out.sort_by_key(|(i, ..)| pad_groups.contains(i));
    out
}

/// The keeper thread: always keeps the feed alive; the rest only while the
/// window is closed (open, the window does it itself).
pub fn start(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let mut last_feed = Instant::now() - Duration::from_secs(60);
        let mut last_script = Instant::now();
        let mut painted: Option<(usize, String)> = None;
        loop {
            std::thread::sleep(Duration::from_millis(250));
            if last_feed.elapsed() >= Duration::from_secs(3) {
                last_feed = Instant::now();
                crate::hidraw::start(&app);
            }
            if window_open() {
                painted = None;
                continue;
            }
            if REPAINT.swap(false, Ordering::Relaxed) {
                painted = None;
            }
            if let Some(bank) = crate::hidraw::knob() {
                let cfg = crate::thrbank::config();
                let key = (bank, serde_json::to_string(&(&cfg["banks"][bank], &cfg["map"], &cfg["throttleLed"])).unwrap_or_default());
                if painted.as_ref() != Some(&key) && crate::led::set(&bank_leds(&cfg, bank)).is_ok() {
                    painted = Some(key);
                }
            }
            if SCRIPT_WANTED.load(Ordering::Relaxed) && last_script.elapsed() >= Duration::from_secs(10) {
                last_script = Instant::now();
                let st = crate::target::status(&app, &crate::dir());
                if st.connected && !st.running {
                    let _ = crate::target::start(&app, &crate::dir());
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    #[test]
    fn bank_leds_dark_pads_and_skip_the_throttle_led() {
        let cfg = serde_json::json!({
            "banks": [{ "color": "#ff0000", "pads": { "5": "a.mp3", "6": "" } }],
            "map": { "6": 1 },
            "throttleLed": 10
        });
        let leds = super::bank_leds(&cfg, 0);
        assert_eq!(leds.len(), 62, "the throttle LED and the all-pads group are left out");
        assert!(leds.contains(&(0, 255, 0, 0)), "pad 5 has a sound: lit");
        assert!(leds.contains(&(1, 0, 0, 0)), "pad 6 has none: dark");
        assert!(leds.contains(&(8, 255, 0, 0)), "the rest in the bank colour");
        assert!(!leds.iter().any(|l| l.0 == 30), "the all-pads group is never sent");
        let first_pad = leds.iter().position(|l| l.0 < 8).unwrap();
        assert!(leds[first_pad..].iter().all(|l| l.0 < 8), "the pads go last");
        assert!(!leds.iter().any(|l| l.0 == 10));
    }
}
