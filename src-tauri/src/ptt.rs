//! Push-to-talk for the voice sounds: Caps Lock is held down while a clip
//! plays, so the game transmits it without anyone pressing the key.
//!
//! The key goes in as a hardware scan code (SendInput + KEYEVENTF_SCANCODE),
//! which games reading raw input see like a real key; Windows derives the
//! virtual key from it for everyone else.
//!
//! Caps Lock is also a toggle: every press flips the caps state. After the
//! release the state is put back as it was, with one more quick tap, so
//! typing afterwards isn't suddenly in capitals.

#[cfg(windows)]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;

const SCAN_CAPS: u16 = 0x3A;

#[cfg(windows)]
fn send(up: bool) -> bool {
    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: 0,
                wScan: SCAN_CAPS,
                dwFlags: KEYEVENTF_SCANCODE | if up { KEYEVENTF_KEYUP } else { 0 },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe { SendInput(1, &input, std::mem::size_of::<INPUT>() as i32) == 1 }
}

#[cfg(windows)]
fn caps_on() -> bool {
    unsafe { GetKeyState(VK_CAPITAL as i32) & 1 != 0 }
}

/// Holds the key between `press` and `release`; remembers the caps state.
#[derive(Default)]
pub struct Ptt {
    held: bool,
    caps_before: bool,
}

impl Ptt {
    pub fn held(&self) -> bool {
        self.held
    }

    /// Key down (once; pressing again while held does nothing). Err when
    /// Windows refused the input - e.g. the game runs as administrator and
    /// this app doesn't.
    pub fn press(&mut self) -> Result<(), String> {
        if self.held {
            return Ok(());
        }
        #[cfg(windows)]
        {
            self.caps_before = caps_on();
            if !send(false) {
                return Err(format!("Windows refused the key: {}", std::io::Error::last_os_error()));
            }
        }
        self.held = true;
        Ok(())
    }

    pub fn release(&mut self) {
        if !self.held {
            return;
        }
        self.held = false;
        #[cfg(windows)]
        {
            send(true);
            // the press flipped Caps Lock: flip it back
            std::thread::sleep(std::time::Duration::from_millis(15));
            if caps_on() != self.caps_before {
                send(false);
                send(true);
            }
        }
    }
}

impl Drop for Ptt {
    /// Never leave the key stuck down.
    fn drop(&mut self) {
        self.release();
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// Real key events on this desktop, so not in the normal run:
    /// `cargo test ptt -- --ignored`
    #[test]
    #[ignore]
    fn caps_lock_is_held_then_released_and_the_light_restored() {
        let down = || unsafe { GetAsyncKeyState(VK_CAPITAL as i32) as u16 & 0x8000 != 0 };
        let before = caps_on();
        let mut p = Ptt::default();
        p.press().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(100));
        assert!(down(), "Caps Lock should read as held");
        p.release();
        std::thread::sleep(std::time::Duration::from_millis(50));
        assert!(!down(), "Caps Lock should be up again");
        assert_eq!(caps_on(), before, "the caps light is back as it was");
    }
}
