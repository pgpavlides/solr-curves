//! The throttle's own banks.
//!
//! The stick's knob picks one of `banks` for the stick's buttons (1-44); the
//! throttle's buttons (45 and up) take theirs from `throttleBanks`, and which
//! one is on is kept here. Holding the throttle's button 48 or 49 for three
//! seconds steps back or forward (hidraw.rs); a short press is still an
//! ordinary button.
//!
//! Which throttle bank is on shows on the stick: one LED ("throttleLed" in
//! hotas_voice.json, an LED group as led.rs counts them) blinks in its colour.
//! The bank survives a restart in throttle_bank.txt next to the settings.

use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

struct State {
    bank: usize,
    config: Value,
}

static STATE: Mutex<State> = Mutex::new(State { bank: 0, config: Value::Null });
static APP: OnceLock<AppHandle> = OnceLock::new();
/// the LED mapping tool is driving the LEDs: stay off them
static PAUSED: AtomicBool = AtomicBool::new(false);
static STOP: AtomicBool = AtomicBool::new(false);

/// how long the bank buttons are held to change bank
pub const HOLD: Duration = Duration::from_secs(3);
const BLINK_ON: Duration = Duration::from_millis(600);
const BLINK_OFF: Duration = Duration::from_millis(400);

fn file() -> std::path::PathBuf {
    crate::dir().join("throttle_bank.txt")
}

fn count(cfg: &Value) -> usize {
    cfg.get("throttleBanks").and_then(|b| b.as_array()).map_or(0, |b| b.len())
}

fn rgb(hex: &str) -> (u8, u8, u8) {
    let n = u32::from_str_radix(hex.trim_start_matches('#'), 16).unwrap_or(0xffffff);
    ((n >> 16) as u8, (n >> 8) as u8, n as u8)
}

/// Start with the saved settings: the bank from last time, and the blinking.
pub fn start(app: &AppHandle, config: &Value) {
    let _ = APP.set(app.clone());
    {
        let mut st = STATE.lock().unwrap();
        st.config = config.clone();
        let saved = std::fs::read_to_string(file()).ok().and_then(|s| s.trim().parse::<usize>().ok()).unwrap_or(0);
        st.bank = saved.min(count(config).saturating_sub(1));
    }
    std::thread::spawn(|| {
        let mut on = true;
        while !STOP.load(Ordering::Relaxed) {
            let lit = {
                let st = STATE.lock().unwrap();
                st.config.get("throttleLed").and_then(|g| g.as_u64()).map(|g| {
                    let colour = st.config["throttleBanks"][st.bank]["color"].as_str().unwrap_or("#ffffff").to_string();
                    (g as u32, colour)
                })
            };
            if let (Some((group, colour)), false) = (lit, PAUSED.load(Ordering::Relaxed)) {
                let (r, g, b) = if on { rgb(&colour) } else { (0, 0, 0) };
                let _ = crate::led::set(&[(group, r, g, b)]);
            }
            std::thread::sleep(if on { BLINK_ON } else { BLINK_OFF });
            on = !on;
        }
    });
}

pub fn set_config(config: &Value) {
    let mut st = STATE.lock().unwrap();
    st.config = config.clone();
    st.bank = st.bank.min(count(config).saturating_sub(1));
}

pub fn bank() -> usize {
    STATE.lock().unwrap().bank
}

/// Put the throttle on bank `i` (kept in range), save it and tell the app.
pub fn set_bank(i: usize) -> usize {
    let bank = {
        let mut st = STATE.lock().unwrap();
        st.bank = i.min(count(&st.config).saturating_sub(1));
        st.bank
    };
    let _ = std::fs::write(file(), bank.to_string());
    if let Some(app) = APP.get() {
        let _ = app.emit("solr:throttle-bank", bank);
    }
    bank
}

/// One bank forward (+1) or back (-1), round the ends.
pub fn step(delta: i64) -> usize {
    let (bank, n) = {
        let st = STATE.lock().unwrap();
        (st.bank as i64, count(&st.config).max(1) as i64)
    };
    set_bank((bank + delta).rem_euclid(n) as usize)
}

pub fn pause(on: bool) {
    PAUSED.store(on, Ordering::Relaxed);
}

pub fn shutdown() {
    STOP.store(true, Ordering::Relaxed);
}

#[cfg(test)]
mod tests {
    #[test]
    fn colours_parse() {
        assert_eq!(super::rgb("#ff8000"), (255, 128, 0));
        assert_eq!(super::rgb("39ff6a"), (0x39, 0xff, 0x6a));
    }
}
