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
    last_emit: Option<Instant>,
}
static STATE: Mutex<State> = Mutex::new(State {
    api: None,
    device_id: None,
    ranges: BTreeMap::new(),
    stick: RawStick { device: String::new(), axes: [0.0; 8], buttons: Vec::new(), hat: None },
    pressed: Vec::new(),
    last_emit: None,
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
                st.pressed[i] = v.value != 0;
            }
            _ => {}
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
        let is_stick = name.to_lowercase().contains("flightstick") || name.contains("0422");
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
    Ok(st.stick.device.clone())
}

pub fn snapshot() -> Option<RawStick> {
    let st = STATE.lock().unwrap();
    st.device_id.map(|_| st.stick.clone())
}

pub fn shutdown() {
    if let Ok(mut st) = STATE.lock() {
        if let (Some(api), Some(id)) = (st.api.as_ref(), st.device_id) {
            unsafe {
                (api.set_polling)(id, 0);
                (api.set_read_values_callback)(id, None, std::ptr::null_mut());
                (api.uninitialize)();
            }
        }
        st.device_id = None;
        st.api = None;
    }
}
