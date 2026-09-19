//! The physical Thrustmaster devices, through the same service client as the
//! scripts (target::with_client).
//!
//! Reading is free. Every function that CHANGES hardware state is only ever
//! called from an explicit click in the Devices view:
//!   - LEDs              TmSCUsbSetControllerLEDState
//!   - hardware deadzone TmSCUsbSetControllerDeadzoneState
//!   - hide from games   TmSCUsbEnableDisableHidDevice (the device's normal
//!                       HID interface; T.A.R.G.E.T. keeps reading it through
//!                       its own filter driver)

use crate::target::{push_line, with_client};
use crate::tmsc::{Ptr, Tmsc};
use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize)]
pub struct Device {
    pub serial: u32,
    pub name: Option<String>,
    pub oem_name: Option<String>,
    pub hardware_id: Option<String>,
    pub instance_id: Option<String>,
    pub firmware_serial: Option<String>,
    pub firmware_version: Option<String>,
    /// T.A.R.G.E.T.'s filter driver sits on it (it can be scripted)
    pub filtered: Option<bool>,
    /// its normal HID interface is enabled (games can see it directly)
    pub hid_enabled: Option<bool>,
    pub led_flags: Option<u8>,
    pub led_intensity: Option<u8>,
    pub deadzone_on: Option<bool>,
}

unsafe fn text(c: &Tmsc, f: unsafe extern "system" fn(u32, *mut Ptr) -> u32, serial: u32) -> Option<String> {
    let mut p: Ptr = std::ptr::null_mut();
    if f(serial, &mut p) != 0 {
        return None;
    }
    c.take_string(p).map(|s| s.trim().to_string())
}

unsafe fn flag(f: unsafe extern "system" fn(u32, *mut u8) -> u32, serial: u32) -> Option<bool> {
    let mut b = 0u8;
    (f(serial, &mut b) == 0).then_some(b != 0)
}

pub fn list(app: &AppHandle) -> Result<Vec<Device>, String> {
    with_client(app, |c| unsafe {
        (c.usb_update_present_devices)();
        let mut p: Ptr = std::ptr::null_mut();
        let mut n: i32 = 0;
        let hr = (c.usb_get_present_devices)(&mut p, &mut n);
        if hr != 0 {
            return Err(format!("Couldn't list devices: {}", c.hr_text(hr)));
        }
        let serials = c.take_u32s(p, n.max(0) as usize);
        Ok(serials
            .into_iter()
            .map(|s| {
                let (mut fw_serial, mut fw_version): (Ptr, Ptr) = (std::ptr::null_mut(), std::ptr::null_mut());
                let fw_ok = (c.usb_get_firmware_info_string)(s, &mut fw_serial, &mut fw_version) == 0;
                let (mut led_flags, mut led_intensity) = (0u8, 0u8);
                let led_ok = (c.usb_get_controller_led_state)(s, &mut led_flags, &mut led_intensity) == 0;
                Device {
                    serial: s,
                    name: text(c, c.usb_get_name_string, s),
                    oem_name: text(c, c.usb_get_name_oem_string, s),
                    hardware_id: text(c, c.usb_get_hardware_id_string, s),
                    instance_id: text(c, c.usb_get_instance_id_string, s),
                    firmware_serial: if fw_ok { c.take_string(fw_serial) } else { None },
                    firmware_version: if fw_ok { c.take_string(fw_version) } else { None },
                    filtered: flag(c.usb_get_if_filtered, s),
                    hid_enabled: flag(c.usb_get_if_hid_enabled, s),
                    led_flags: led_ok.then_some(led_flags),
                    led_intensity: led_ok.then_some(led_intensity),
                    deadzone_on: flag(c.usb_get_controller_deadzone_state, s),
                }
            })
            .collect())
    })?
}

pub fn set_led(app: &AppHandle, serial: u32, flags: u8, intensity: u8) -> Result<(), String> {
    with_client(app, |c| unsafe {
        let hr = (c.usb_set_controller_led_state)(serial, flags, intensity);
        if hr != 0 { Err(format!("LED: {}", c.hr_text(hr))) } else { Ok(()) }
    })?
}

pub fn set_deadzone(app: &AppHandle, serial: u32, on: bool) -> Result<(), String> {
    with_client(app, |c| unsafe {
        let hr = (c.usb_set_controller_deadzone_state)(serial, on as u8);
        if hr != 0 { return Err(format!("Deadzone: {}", c.hr_text(hr))); }
        push_line("info", format!("Device {serial}: hardware deadzone {}", if on { "on" } else { "off" }));
        Ok(())
    })?
}

/// Returns whether Windows says a reboot is needed for it to take effect.
pub fn set_hid_enabled(app: &AppHandle, serial: u32, enabled: bool) -> Result<bool, String> {
    with_client(app, |c| unsafe {
        let mut reboot = 0u8;
        let hr = (c.usb_enable_disable_hid_device)(serial, enabled as u8, &mut reboot);
        if hr != 0 { return Err(format!("{}: {}", if enabled { "Show to games" } else { "Hide from games" }, c.hr_text(hr))); }
        push_line("info", format!(
            "Device {serial}: {}{}",
            if enabled { "visible to games again" } else { "hidden from games (T.A.R.G.E.T. still reads it)" },
            if reboot != 0 { " - Windows needs a restart for this" } else { "" }
        ));
        Ok(reboot != 0)
    })?
}
