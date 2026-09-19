//! The Sol-R's RGB button LEDs.
//!
//! Not in any DLL: T.A.R.G.E.T. drives them through a named pipe served by
//! TargetLEDControl.exe (it spawns that for Sol-R devices). From target.tmh:
//!
//!   LEDRGB(dev, led_index, r, g, b) -> LED_control(pid, group, rgb)
//!     pid   = 0x422 for the Sol-R [R] Flightstick (base + right grip)
//!     group = led_index - 1
//!     rgb   = r | g << 8 | b << 16
//!   LED_control writes 8 bytes to \\.\pipe\TargetLedControlPipe:
//!     u32 (pid << 16) | group, then u32 rgb
//!
//! Which group lights which button isn't documented; the Voice page maps it
//! on the real stick (light one, press the one that glows).

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

pub const SOLR_PID: u32 = 0x422;
const PIPE: &str = r"\\.\pipe\TargetLedControlPipe";

static PIPE_FILE: Mutex<Option<File>> = Mutex::new(None);

fn server_exe() -> std::path::PathBuf {
    std::path::Path::new(crate::tmsc::TARGET_DIR).join("TargetLEDControl.exe")
}

/// T.A.R.G.E.T. only starts the LED server when a script runs Init() with a
/// Sol-R; start it ourselves if it isn't there.
fn ensure_server() {
    let running = std::process::Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq TargetLEDControl.exe", "/NH"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("TargetLEDControl.exe"))
        .unwrap_or(false);
    if !running {
        let mut c = std::process::Command::new(server_exe());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let _ = c.spawn();
        std::thread::sleep(std::time::Duration::from_millis(400));
    }
}

fn frame(pid: u32, group: u32, rgb: u32) -> [u8; 8] {
    let mut b = [0u8; 8];
    b[..4].copy_from_slice(&((pid << 16) | (group & 0xffff)).to_le_bytes());
    b[4..].copy_from_slice(&(rgb & 0xff_ffff).to_le_bytes());
    b
}

/// Set LED `group` (0-based) of the Sol-R to r, g, b. Several at once share
/// one pipe connection.
pub fn set(leds: &[(u32, u8, u8, u8)]) -> Result<(), String> {
    let mut guard = PIPE_FILE.lock().unwrap();
    for attempt in 0..2 {
        if guard.is_none() {
            if attempt == 1 {
                ensure_server();
            }
            match OpenOptions::new().write(true).open(PIPE) {
                Ok(f) => *guard = Some(f),
                Err(e) if attempt == 1 => return Err(format!("LED server not reachable ({e})")),
                Err(_) => continue,
            }
        }
        let f = guard.as_mut().unwrap();
        let ok = leds.iter().all(|&(group, r, g, b)| {
            let rgb = r as u32 | (g as u32) << 8 | (b as u32) << 16;
            f.write_all(&frame(SOLR_PID, group, rgb)).is_ok()
        });
        if ok {
            return Ok(());
        }
        // the server drops a client after each session; reconnect once
        *guard = None;
    }
    Err("LED server closed the connection".into())
}

#[cfg(test)]
mod tests {
    /// Byte layout identical to target.tmh's LED_control for LEDRGB(&Sol_SolR, 5, 255, 128, 0).
    #[test]
    fn frame_matches_target() {
        let f = super::frame(0x422, 4, 255 | 128 << 8);
        assert_eq!(f, [0x04, 0x00, 0x22, 0x04, 0xff, 0x80, 0x00, 0x00]);
    }
}
