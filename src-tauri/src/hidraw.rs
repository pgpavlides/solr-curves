//! The physical stick's raw values, read through T.A.R.G.E.T.'s filter.
//!
//! While a script runs, T.A.R.G.E.T. hides the physical Sol-R from Windows
//! (the device is disabled, code 22), so games only see Thrustmaster Combined.
//! That also hides it from the browser Gamepad API this app used for the
//! "your hand" view. TmHidRaw.dll - the library behind Thrustmaster's own
//! Device Analyzer - reads devices through the filter instead, hidden or not.
//!
//! API and record layouts from the Device Analyzer's .NET metadata
//! (sequential, pack 8):
//!
//!   TmHRFilterGetDevicesList(out ptr, out n)   ptr -> u32[n] device ids
//!   TmHRGetDeviceCapabilities(id, out ptr, out n)
//!        ptr -> { u16 usage, u16 usagePage, u8 absolute, u32 min, u32 max, i32 controlNo }[n]  (20 bytes)
//!   TmHRSetReadDeviceValuesCallback(id, cb(param, data, n), param) + TmHRSetPolling(id, 1)
//!        data -> { u16 usage, u16 usagePage, i32 value, i32 scaled, i32 controlNo }[n]      (16 bytes)
//!
//! Axes come as HID usages (page 1: X=48 .. RZ=53, Slider=54, Dial=55), buttons
//! as page 9 with the button number as usage.

use libloading::os::windows::{Library, LOAD_WITH_ALTERED_SEARCH_PATH};
use serde::Serialize;
use std::collections::BTreeMap;
use std::ffi::c_void;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

type Hr = u32;
type Ptr = *mut c_void;
type ValuesCb = unsafe extern "system" fn(Ptr, Ptr, u32) -> i32;

struct Api {
    _lib: Library,
    initialize: unsafe extern "system" fn() -> Hr,
    uninitialize: unsafe extern "system" fn() -> Hr,
    filter_get_devices_list: unsafe extern "system" fn(*mut Ptr, *mut u32) -> Hr,
    get_device_name: unsafe extern "system" fn(u32, *mut Ptr) -> Hr,
    get_device_capabilities: unsafe extern "system" fn(u32, *mut Ptr, *mut u32) -> Hr,
    set_read_values_callback: unsafe extern "system" fn(u32, Option<ValuesCb>, Ptr) -> Hr,
    set_polling: unsafe extern "system" fn(u32, u8) -> Hr,
    free: unsafe extern "system" fn(Ptr) -> Hr,
}
unsafe impl Send for Api {}

#[repr(C)]
#[derive(Clone, Copy)]
struct Capability {
    usage: u16,
    usage_page: u16,
    absolute: u8,
    min: u32,
    max: u32,
    control_no: i32,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Value {
    usage: u16,
    usage_page: u16,
    value: i32,
    scaled: i32,
    control_no: i32,
}

const PAGE_GENERIC: u16 = 1;
const PAGE_BUTTON: u16 = 9;
const USAGE_X: u16 = 48; // X Y Z RX RY RZ SLIDER DIAL = 48..55
const USAGE_HAT: u16 = 57;
/// The 4-position knob on the base: buttons 20-23, one held at a time.
const KNOB: [usize; 4] = [20, 21, 22, 23];

/// What the frontend gets: axes in Gamepad API order (X, Y, Z, RX, RY, RZ,
/// Slider, Dial), -1..1, and the pressed buttons as Windows numbers them.
#[derive(Clone, Serialize, Default)]
pub struct RawStick {
    pub device: String,
    pub axes: [f32; 8],
    pub buttons: Vec<u16>,
    pub hat: Option<i32>,
}

struct State {
    api: Option<Api>,
    device_id: Option<u32>,
    ranges: BTreeMap<u16, (i64, i64)>, // axis usage -> (min, max)
    stick: RawStick,
    pressed: Vec<bool>,
    /// the knob's last reported position (0-3), kept while it turns
    bank: Option<usize>,
    last_emit: Option<Instant>,
    // the Sol-R 6 Throttle, read the same way (hidden from Windows too once
    // the script uses it)
    thr_id: Option<u32>,
    thr_ranges: BTreeMap<u16, (i64, i64)>,
    thr: RawStick,
    thr_pressed: Vec<bool>,
    thr_emit: Option<Instant>,
    /// last time we looked for the throttle (it can join the filter later)
    thr_tried: Option<Instant>,
    /// the bank buttons (48, 49): which press this is, and whether holding it
    /// has already changed the bank (then letting go does nothing)
    thr_hold: [u64; 2],
    thr_switched: [bool; 2],
}

/*
  The throttle's bank buttons, as its own feed numbers them: 4 and 5 are the
  game's 48 and 49. Held for thrbank::HOLD they step the throttle bank back
  (48) or forward (49); let go sooner and they are ordinary buttons - their
  sound or macro goes off when you let go instead of when you press.
*/
const THR_BANK_BUTTONS: [u16; 2] = [4, 5];

/// The throttle's buttons as the game sees them: after the stick's 44 (the
/// script maps TBTN1..6 and its hats to DX45..DX58), so a sound or a macro on
/// "button 45" is the throttle's first button everywhere.
pub const THROTTLE_FIRST: u16 = 44;
static STATE: Mutex<State> = Mutex::new(State {
    api: None,
    device_id: None,
    ranges: BTreeMap::new(),
    stick: RawStick { device: String::new(), axes: [0.0; 8], buttons: Vec::new(), hat: None },
    pressed: Vec::new(),
    bank: None,
    last_emit: None,
    thr_id: None,
    thr_ranges: BTreeMap::new(),
    thr: RawStick { device: String::new(), axes: [0.0; 8], buttons: Vec::new(), hat: None },
    thr_pressed: Vec::new(),
    thr_emit: None,
    thr_tried: None,
    thr_hold: [0; 2],
    thr_switched: [false; 2],
});
static APP: OnceLock<AppHandle> = OnceLock::new();

unsafe fn take_string(api: &Api, p: Ptr) -> Option<String> {
    if p.is_null() {
        return None;
    }
    let b = p as *const u8;
    let s = if *b != 0 && *b.add(1) == 0 {
        let w = p as *const u16;
        let mut n = 0;
        while *w.add(n) != 0 && n < 512 {
            n += 1;
        }
        String::from_utf16_lossy(std::slice::from_raw_parts(w, n))
    } else {
        let mut n = 0;
        while *b.add(n) != 0 && n < 512 {
            n += 1;
        }
        String::from_utf8_lossy(std::slice::from_raw_parts(b, n)).into_owned()
    };
    (api.free)(p);
    Some(s)
}

unsafe extern "system" fn on_values(_param: Ptr, data: Ptr, n: u32) -> i32 {
    if data.is_null() || n == 0 {
        return 0;
    }
    let vals = std::slice::from_raw_parts(data as *const Value, (n as usize).min(512));
    // never wait here: the DLL may call back while connect() holds the lock
    // (it does during set_polling); dropping one sample is harmless
    let Ok(mut st) = STATE.try_lock() else { return 0 };
    let mut downs: Vec<u16> = vec![];
    for v in vals {
        match v.usage_page {
            PAGE_GENERIC if (USAGE_X..USAGE_X + 8).contains(&v.usage) => {
                let (min, max) = st.ranges.get(&v.usage).copied().unwrap_or((0, 65535));
                let span = (max - min).max(1) as f32;
                let x = ((v.value as i64 - min) as f32 / span) * 2.0 - 1.0;
                st.stick.axes[(v.usage - USAGE_X) as usize] = x.clamp(-1.0, 1.0);
            }
            PAGE_GENERIC if v.usage == USAGE_HAT => st.stick.hat = Some(v.value),
            PAGE_BUTTON if v.usage >= 1 && v.usage <= 128 => {
                let i = v.usage as usize;
                if st.pressed.len() <= i {
                    st.pressed.resize(i + 1, false);
                }
                let down = v.value != 0;
                if down && !st.pressed[i] {
                    downs.push(v.usage);
                }
                st.pressed[i] = down;
            }
            _ => {}
        }
    }
    // voice control: a press plays its bank's sound (the knob, 20-23, is the bank).
    // Mid-turn the knob holds nothing, so the last position it reported stands.
    if let Some(k) = KNOB.iter().position(|&b| st.pressed.get(b).copied().unwrap_or(false)) {
        st.bank = Some(k);
    }
    if !downs.is_empty() {
        let bank = st.bank;
        for b in downs {
            crate::sound::press(b, bank);
            crate::macros::press(b, bank);
        }
    }
    st.stick.buttons = st.pressed.iter().enumerate().filter(|(_, p)| **p).map(|(i, _)| i as u16).collect();
    // ~120 updates a second is plenty for a dot on a graph
    let now = Instant::now();
    if st.last_emit.map_or(true, |t| now.duration_since(t) >= Duration::from_millis(8)) {
        st.last_emit = Some(now);
        if let Some(app) = APP.get() {
            let _ = app.emit("solr:raw-stick", st.stick.clone());
        }
    }
    0
}

#[derive(Serialize)]
pub struct RawStatus {
    pub connected: bool,
    pub device: Option<String>,
    pub error: Option<String>,
}

/// Find the Sol-R flightstick among the filter's devices and start reading it.
/// Safe to call repeatedly; it (re)connects only when not reading.
pub fn start(app: &AppHandle) -> RawStatus {
    let _ = APP.set(app.clone());
    // never queue up behind a connect that is stuck (the frontend retries
    // every few seconds; each waiting call would tie up a thread for good)
    let Ok(mut st) = STATE.try_lock() else {
        return RawStatus { connected: false, device: None, error: Some("busy".into()) };
    };
    if st.device_id.is_some() {
        /*
          Connected to the stick, but maybe not yet to the throttle: T.A.R.G.E.T.
          only puts a device in its filter once it can drive it (after a driver
          update or a replug), so keep looking now and then until it's there.
        */
        let due = st.thr_tried.map_or(true, |t| t.elapsed() >= Duration::from_secs(5));
        if st.thr_id.is_none() && due && crate::target::service_running() {
            st.thr_tried = Some(Instant::now());
            unsafe { attach_throttle(&mut st) };
        }
        return RawStatus { connected: true, device: Some(st.stick.device.clone()), error: None };
    }
    // the filter's reader needs Thrustmaster's service; without it the DLL
    // hangs instead of failing
    if !crate::target::service_running() {
        return RawStatus { connected: false, device: None, error: Some("service-stopped".into()) };
    }
    let result = unsafe { connect(&mut st) };
    match result {
        Ok(name) => RawStatus { connected: true, device: Some(name), error: None },
        Err(e) => RawStatus { connected: false, device: None, error: Some(e) },
    }
}

unsafe fn connect(st: &mut State) -> Result<String, String> {
    if st.api.is_none() {
        let path = std::path::Path::new(crate::tmsc::TARGET_DIR).join(r"x64\TmHidRaw.dll");
        let lib = Library::load_with_flags(&path, LOAD_WITH_ALTERED_SEARCH_PATH).map_err(|e| e.to_string())?;
        macro_rules! f {
            ($n:literal) => {
                *lib.get(concat!($n, "\0").as_bytes()).map_err(|e| format!("{}: {e}", $n))?
            };
        }
        let api = Api {
            initialize: f!("TmHRInitialize"),
            uninitialize: f!("TmHRUnInitialize"),
            filter_get_devices_list: f!("TmHRFilterGetDevicesList"),
            get_device_name: f!("TmHRGetDeviceName"),
            get_device_capabilities: f!("TmHRGetDeviceCapabilities"),
            set_read_values_callback: f!("TmHRSetReadDeviceValuesCallback"),
            set_polling: f!("TmHRSetPolling"),
            free: f!("TmHRFree"),
            _lib: lib,
        };
        let hr = (api.initialize)();
        if hr != 0 {
            return Err(format!("TmHRInitialize 0x{hr:08X}"));
        }
        st.api = Some(api);
    }
    let api = st.api.as_ref().unwrap();
    let mut p: Ptr = std::ptr::null_mut();
    let mut n: u32 = 0;
    let hr = (api.filter_get_devices_list)(&mut p, &mut n);
    if hr != 0 || p.is_null() {
        return Err(format!("no filtered devices (0x{hr:08X})"));
    }
    let ids = std::slice::from_raw_parts(p as *const u32, (n as usize).min(32)).to_vec();
    (api.free)(p);

    // the flightstick: the filtered device with an X axis whose name says so
    let mut chosen: Option<(u32, String, Vec<Capability>)> = None;
    let mut throttle: Option<(u32, String, Vec<Capability>)> = None;
    for id in ids {
        let mut np: Ptr = std::ptr::null_mut();
        let name = if (api.get_device_name)(id, &mut np) == 0 { take_string(api, np).unwrap_or_default() } else { String::new() };
        let mut cp: Ptr = std::ptr::null_mut();
        let mut cn: u32 = 0;
        let caps = if (api.get_device_capabilities)(id, &mut cp, &mut cn) == 0 && !cp.is_null() {
            let v = std::slice::from_raw_parts(cp as *const Capability, (cn as usize).min(256)).to_vec();
            (api.free)(cp);
            v
        } else {
            vec![]
        };
        let has_x = caps.iter().any(|c| c.usage_page == PAGE_GENERIC && c.usage == USAGE_X);
        let lower = name.to_lowercase();
        if lower.contains("throttle") || name.contains("0447") {
            throttle = Some((id, name, caps));
            continue;
        }
        let is_stick = lower.contains("flightstick") || name.contains("0422");
        if has_x && (is_stick || chosen.is_none()) {
            chosen = Some((id, name, caps));
            if is_stick {
                break;
            }
        }
    }
    let (id, name, caps) = chosen.ok_or("no filtered stick with an X axis")?;
    st.ranges = caps
        .iter()
        .filter(|c| c.usage_page == PAGE_GENERIC && (USAGE_X..USAGE_X + 8).contains(&c.usage))
        .map(|c| (c.usage, (c.min as i64, c.max as i64)))
        .collect();
    let hr = (api.set_read_values_callback)(id, Some(on_values), std::ptr::null_mut());
    if hr != 0 {
        return Err(format!("TmHRSetReadDeviceValuesCallback 0x{hr:08X}"));
    }
    (api.set_polling)(id, 1);
    st.device_id = Some(id);
    st.stick.device = if name.is_empty() { format!("device {id}") } else { name.clone() };

    // the throttle, when there is one: optional, the stick works without it
    if let Some(t) = throttle {
        use_throttle(st, t);
    }
    st.thr_tried = Some(Instant::now());
    Ok(st.stick.device.clone())
}

/// Start reading the throttle found in the filter.
unsafe fn use_throttle(st: &mut State, (tid, tname, tcaps): (u32, String, Vec<Capability>)) {
    let Some(api) = st.api.as_ref() else { return };
    let ranges = tcaps
        .iter()
        .filter(|c| c.usage_page == PAGE_GENERIC && (USAGE_X..USAGE_X + 8).contains(&c.usage))
        .map(|c| (c.usage, (c.min as i64, c.max as i64)))
        .collect();
    if (api.set_read_values_callback)(tid, Some(on_throttle), std::ptr::null_mut()) == 0 {
        (api.set_polling)(tid, 1);
        st.thr_ranges = ranges;
        st.thr_id = Some(tid);
        st.thr.device = if tname.is_empty() { format!("device {tid}") } else { tname };
    }
}

/// Look through the filter for the throttle alone (the stick is already on).
unsafe fn attach_throttle(st: &mut State) {
    let Some(api) = st.api.as_ref() else { return };
    let mut p: Ptr = std::ptr::null_mut();
    let mut n: u32 = 0;
    if (api.filter_get_devices_list)(&mut p, &mut n) != 0 || p.is_null() {
        return;
    }
    let ids = std::slice::from_raw_parts(p as *const u32, (n as usize).min(32)).to_vec();
    (api.free)(p);
    for id in ids {
        if Some(id) == st.device_id {
            continue;
        }
        let mut np: Ptr = std::ptr::null_mut();
        let name = if (api.get_device_name)(id, &mut np) == 0 { take_string(api, np).unwrap_or_default() } else { String::new() };
        if !(name.to_lowercase().contains("throttle") || name.contains("0447")) {
            continue;
        }
        let mut cp: Ptr = std::ptr::null_mut();
        let mut cn: u32 = 0;
        let caps = if (api.get_device_capabilities)(id, &mut cp, &mut cn) == 0 && !cp.is_null() {
            let v = std::slice::from_raw_parts(cp as *const Capability, (cn as usize).min(256)).to_vec();
            (api.free)(cp);
            v
        } else {
            vec![]
        };
        use_throttle(st, (id, name, caps));
        return;
    }
}

/// The throttle's callback: the same record layout as the stick's.
unsafe extern "system" fn on_throttle(_param: Ptr, data: Ptr, n: u32) -> i32 {
    if data.is_null() || n == 0 {
        return 0;
    }
    let vals = std::slice::from_raw_parts(data as *const Value, (n as usize).min(512));
    let Ok(mut st) = STATE.try_lock() else { return 0 };
    let mut downs: Vec<u16> = vec![];
    let mut holds: Vec<(usize, u64)> = vec![];
    for v in vals {
        match v.usage_page {
            PAGE_GENERIC if (USAGE_X..USAGE_X + 8).contains(&v.usage) => {
                let (min, max) = st.thr_ranges.get(&v.usage).copied().unwrap_or((0, 65535));
                let span = (max - min).max(1) as f32;
                let x = ((v.value as i64 - min) as f32 / span) * 2.0 - 1.0;
                st.thr.axes[(v.usage - USAGE_X) as usize] = x.clamp(-1.0, 1.0);
            }
            PAGE_GENERIC if v.usage == USAGE_HAT => st.thr.hat = Some(v.value),
            PAGE_BUTTON if v.usage >= 1 && v.usage <= 64 => {
                let i = v.usage as usize;
                if st.thr_pressed.len() <= i {
                    st.thr_pressed.resize(i + 1, false);
                }
                let down = v.value != 0;
                let was = st.thr_pressed[i];
                if let Some(k) = THR_BANK_BUTTONS.iter().position(|&b| b == v.usage) {
                    if down && !was {
                        st.thr_hold[k] += 1;
                        st.thr_switched[k] = false;
                        holds.push((k, st.thr_hold[k]));
                    } else if !down && was && !st.thr_switched[k] {
                        downs.push(THROTTLE_FIRST + v.usage);
                    }
                } else if down && !was {
                    downs.push(THROTTLE_FIRST + v.usage);
                }
                st.thr_pressed[i] = down;
            }
            _ => {}
        }
    }
    // still held when the time is up (and not let go and pressed again): change bank
    for (k, press) in holds {
        std::thread::spawn(move || {
            std::thread::sleep(crate::thrbank::HOLD);
            let held = {
                let mut st = STATE.lock().unwrap();
                let usage = THR_BANK_BUTTONS[k] as usize;
                let held = st.thr_hold[k] == press && st.thr_pressed.get(usage).copied().unwrap_or(false);
                if held {
                    st.thr_switched[k] = true;
                }
                held
            };
            if held {
                crate::thrbank::step(if k == 0 { -1 } else { 1 });
            }
        });
    }
    // the throttle's buttons play and type in the throttle's own bank
    if !downs.is_empty() {
        let bank = Some(crate::thrbank::bank());
        for b in downs {
            crate::sound::press(b, bank);
            crate::macros::press(b, bank);
        }
    }
    st.thr.buttons = st
        .thr_pressed
        .iter()
        .enumerate()
        .filter(|(_, p)| **p)
        .map(|(i, _)| THROTTLE_FIRST + i as u16)
        .collect();
    let now = Instant::now();
    if st.thr_emit.map_or(true, |t| now.duration_since(t) >= Duration::from_millis(8)) {
        st.thr_emit = Some(now);
        if let Some(app) = APP.get() {
            let _ = app.emit("solr:raw-throttle", st.thr.clone());
        }
    }
    0
}

/// The throttle's last reading, if it is connected.
/// The knob's position (the stick's bank), as last reported.
pub fn knob() -> Option<usize> {
    STATE.lock().ok()?.bank
}

pub fn snapshot_throttle() -> Option<RawStick> {
    let st = STATE.lock().unwrap();
    st.thr_id.map(|_| st.thr.clone())
}

pub fn snapshot() -> Option<RawStick> {
    let st = STATE.lock().unwrap();
    st.device_id.map(|_| st.stick.clone())
}

pub fn shutdown() {
    if let Ok(mut st) = STATE.lock() {
        if let (Some(api), Some(id)) = (st.api.as_ref(), st.device_id) {
            unsafe {
                if let Some(tid) = st.thr_id {
                    (api.set_polling)(tid, 0);
                    (api.set_read_values_callback)(tid, None, std::ptr::null_mut());
                }
                (api.set_polling)(id, 0);
                (api.set_read_values_callback)(id, None, std::ptr::null_mut());
                (api.uninitialize)();
            }
        }
        st.device_id = None;
        st.thr_id = None;
        st.api = None;
    }
}
