//! Complete bindings for Thrustmaster's TmServiceControl.dll (x64).
//!
//! Every export the Script Editor declares, with the Script Editor's own
//! signatures (read from its P/Invoke metadata):
//!
//!   - strings passed IN are UTF-16 (MarshalAs LPWStr)
//!   - strings coming OUT are DLL-allocated pointers ("out IntPtr"), released
//!     with TmSCFree; `take_string` reads them and frees them
//!   - return values are HRESULT-style: 0 = OK
//!
//! Nothing here decides *when* to call what; that is target.rs (scripts) and
//! devices.rs (hardware). This file is only the typed surface, loaded once.

#![allow(dead_code)]

use libloading::os::windows::{Library, LOAD_WITH_ALTERED_SEARCH_PATH};
use std::ffi::{c_char, c_void};
use std::path::{Path, PathBuf};

pub type Hr = u32;
pub type Ptr = *mut c_void;
pub type MsgCb = unsafe extern "system" fn(Ptr, *const c_char, i32) -> i32;
pub type NotifCb = unsafe extern "system" fn(Ptr, i32, u32) -> i32;

pub const TARGET_DIR: &str = r"C:\Program Files (x86)\Thrustmaster\TARGET";

pub fn dll_path() -> PathBuf {
    Path::new(TARGET_DIR).join(r"x64\TmServiceControl.dll")
}

pub fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

macro_rules! api {
    ($( $field:ident : $sym:literal => fn($($arg:ty),*) $(-> $ret:ty)? ; )*) => {
        pub struct Tmsc {
            _lib: Library,
            $( pub $field: unsafe extern "system" fn($($arg),*) $(-> $ret)?, )*
        }
        impl Tmsc {
            pub fn load() -> Result<Self, String> {
                let path = dll_path();
                if !path.exists() {
                    return Err(format!("T.A.R.G.E.T. is not installed ({} not found)", path.display()));
                }
                unsafe {
                    // altered search path: its dependencies sit next to it in x64\
                    let lib = Library::load_with_flags(&path, LOAD_WITH_ALTERED_SEARCH_PATH).map_err(|e| e.to_string())?;
                    Ok(Tmsc {
                        $( $field: *lib.get(concat!($sym, "\0").as_bytes()).map_err(|e| format!("{}: {e}", $sym))?, )*
                        _lib: lib,
                    })
                }
            }
        }
    };
}

api! {
    // ---- service / client
    initialize_control: "TmSCInitializeControl" => fn() -> Hr;
    initialize_status: "TmSCInitializeStatus" => fn() -> Hr;
    uninitialize: "TmSCUnInitialize" => fn() -> Hr;
    check_service_match: "TmSCCheckServiceMatch" => fn() -> Hr;
    get_service_status: "TmSCGetServiceStatus" => fn(i32) -> u8;
    start_service: "TmSCStartService" => fn(*const u16) -> Hr;
    stop_on_client_close: "TmSCServiceSetStopOnClientClose" => fn(u8) -> Hr;
    set_message_callback: "TmSCSetMessageCallback" => fn(Option<MsgCb>, Ptr) -> Hr;
    set_notif_callback: "TmSCSetNotifCallback" => fn(Option<NotifCb>, Ptr) -> Hr;
    debug_set_logging: "TmSCDebugSetLogging" => fn(u8, *const u16) -> Hr;

    // ---- memory the DLL hands out
    allocate: "TmSCAllocate" => fn(u32, *const u16) -> Ptr;
    free: "TmSCFree" => fn(Ptr) -> Hr;
    // exported only under its C++-mangled name
    free_with_tag: "?TmSCFreeWithTag@@YAJPEAXPEB_W@Z" => fn(Ptr, *const u16) -> Hr;

    // ---- scripts
    script_load: "TmSCScriptLoad" => fn(*const u16) -> Hr;
    script_send_folder_path: "TmSCScriptSendFolderPath" => fn(i32, *const u16) -> Hr;
    script_send_params: "TmSCScriptSendParams" => fn(*const u16) -> Hr;
    script_compile: "TmSCScriptCompile" => fn() -> Hr;
    script_get_includes: "TmSCScriptGetIncludes" => fn(i32, *mut Ptr) -> Hr;
    script_get_function_list: "TmSCScriptGetFunctionList" => fn(*mut Ptr) -> Hr;
    script_get_variable_list: "TmSCScriptGetVariableList" => fn(*mut Ptr) -> Hr;
    script_get_defines_list: "TmSCScriptGetDefinesList" => fn(*mut Ptr) -> Hr;
    script_run: "TmSCScriptRun" => fn(u32) -> Hr;
    script_run_async: "TmSCScriptRunAsync" => fn(u32) -> Hr;
    script_stop: "TmSCScriptStop" => fn() -> Hr;
    script_get_is_running: "TmSCScriptGetIsRunning" => fn(*mut u8) -> Hr;
    script_get_is_pending: "TmSCScriptGetIsPending" => fn(*mut u8) -> Hr;
    script_send_load_plugin: "TmSCScriptSendLoadPlugin" => fn(*const u16) -> Hr;
    script_send_load_plugin_directory: "TmSCScriptSendLoadPluginDirectory" => fn(*const u16) -> Hr;
    script_get_if_module_is_loaded: "TmSCScriptGetIfModuleIsLoaded" => fn(*const u16, *mut u8) -> Hr;
    script_get_module: "TmSCScriptGetModule" => fn(i32, *mut Ptr) -> Hr;
    script_free_plugin: "TmSCScriptFreePlugin" => fn() -> Hr;

    // ---- virtual HID devices (what games see)
    hid_plug_mouse: "TmSCHidPlugMouse" => fn(u8, u32) -> Hr;
    hid_plug_joystick: "TmSCHidPlugJoystick" => fn(u32, u8, *const u8, u32) -> Hr;
    hid_plug_keyboard: "TmSCHidPlugKeyBoard" => fn(u32) -> Hr;
    hid_unplug_virtual_device: "TmSCHidUnPlugVirtualDevice" => fn(u32) -> Hr;
    hid_unplug_all_devices: "TmSCHidUnplugAllDevices" => fn(u32) -> Hr;
    hid_refresh_devices: "TmSCHidRefreshDevices" => fn() -> Hr;
    hid_get_device_by_type: "TmSCHidGetDeviceByType" => fn(i32) -> u32;
    hid_clear_input: "TmSCHidClearInput" => fn(u32) -> Hr;
    hid_get_present_devices: "TmSCHidGetPresentDevices" => fn(*mut Ptr, *mut u32) -> Hr;
    hid_get_device_id_info: "TmSCHidGetDeviceIdInfo" => fn(u32, *mut Ptr) -> Hr;
    hid_get_device_type_info: "TmSCHidGetDeviceTypeinfo" => fn(u32, *mut i32) -> Hr;
    hid_get_device_hid_capabilities: "TmSCHidGetDeviceHidCapabilities" => fn(u32, *mut Ptr) -> Hr;
    hid_get_game_oem_name: "TmSCHidGetGameOEMName" => fn(u32, *mut Ptr) -> Hr;
    hid_set_game_oem_name: "TmSCHidSetGameOEMName" => fn(u32, *const u16) -> Hr;
    hid_delete_hid_dev_calibration_data: "TmSCHidDeleteHidDevCalibrationData" => fn() -> Hr;

    // ---- physical USB devices (the Sol-R itself)
    usb_update_present_devices: "TmSCUsbUpdatePresentDevices" => fn() -> Hr;
    usb_get_present_devices: "TmSCUsbGetPresentDevices" => fn(*mut Ptr, *mut i32) -> Hr;
    usb_get_hardware_id_string: "TmSCUsbGetHardwareIDString" => fn(u32, *mut Ptr) -> Hr;
    usb_get_instance_id_string: "TmSCUsbGetInstanceIDString" => fn(u32, *mut Ptr) -> Hr;
    usb_get_name_string: "TmSCUsbGetNameString" => fn(u32, *mut Ptr) -> Hr;
    usb_get_name_oem_string: "TmSCUsbGetNameOEMString" => fn(u32, *mut Ptr) -> Hr;
    usb_get_firmware_info_string: "TmSCUsbGetFirmwareInfoString" => fn(u32, *mut Ptr, *mut Ptr) -> Hr;
    usb_get_controller_deadzone_state: "TmSCUsbGetControllerDeadzoneState" => fn(u32, *mut u8) -> Hr;
    usb_set_controller_deadzone_state: "TmSCUsbSetControllerDeadzoneState" => fn(u32, u8) -> Hr;
    usb_get_controller_led_state: "TmSCUsbGetControllerLEDState" => fn(u32, *mut u8, *mut u8) -> Hr;
    usb_set_controller_led_state: "TmSCUsbSetControllerLEDState" => fn(u32, u8, u8) -> Hr;
    usb_get_if_filtered: "TmSCUsbGetIfFiltered" => fn(u32, *mut u8) -> Hr;
    usb_get_if_hid_enabled: "TmSCUsbGetIfHidEnabled" => fn(u32, *mut u8) -> Hr;
    usb_enable_disable_hid_device: "TmSCUsbEnableDisableHidDevice" => fn(u32, u8, *mut u8) -> Hr;
    usb_add_hid_usb_filter: "TmSCUsbAddHidUsbFilter" => fn(u32, u8, u32) -> Hr;

    // ---- the T.A.R.G.E.T. filter driver
    filter_get_present_devices: "TmSCFilterGetPresentDevices" => fn(*mut Ptr, *mut u32) -> Hr;
    filter_get_serial_no_for_usb: "TmSCFilterGetSerialNoForUsb" => fn(u32) -> u32;
    filter_get_reports_mode: "TmSCFilterGetReportsMode" => fn(u32, *mut i32) -> Hr;
    filter_set_reports_mode: "TmSCFilterSetReportsMode" => fn(u32, i32) -> Hr;
    filter_get_device_hid_capabilities: "TmSCFilterGetDeviceHidCapabilities" => fn(u32, *mut Ptr) -> Hr;
    filter_delete_usb_dev_calibration_data: "TmSCFilterDeleteUsbDevCalibrationData" => fn(u32) -> Hr;
    filter_get_device_type_for_serial_no: "TmSCFilterGetDeviceTypeForSerialNo" => fn(u32, *mut i32) -> Hr;

    // ---- status (C++-mangled exports; need initialize_status first)
    status_is_script_running: "?TmSCStatusIsScriptRunning@@YAJPEAE@Z" => fn(*mut u8) -> Hr;
    status_get_selected_devices: "?TmSCStatusGetSelectedDevices@@YAJPEAPEAKPEAH@Z" => fn(*mut Ptr, *mut i32) -> Hr;
    status_get_filtered_device_name: "?TmSCStatusGetFilteredDeviceName@@YAJKPEAPEA_W@Z" => fn(u32, *mut Ptr) -> Hr;
    usb_direct_input_update: "?TmSCUsbDirectInputUpdate@@YAJXZ" => fn() -> Hr;

    // ---- helpers
    help_get_key_name: "TmSCHelpGetKeyName" => fn(u8, *mut Ptr) -> Hr;
    help_get_key_ascii: "TmSCHelpGetKeyAscii" => fn(u8, *mut u16) -> Hr;
    help_get_key_code_from_name: "TmSCHelpGetKeyCodeFromName" => fn(*const u16, *mut u8) -> Hr;
    help_get_hresult_string: "TmSCHelpGetHresultString" => fn(u32, *mut Ptr) -> Hr;
    help_get_axes_response_dead_zones: "TmSCHelpGetAxesResponseDeadZones" => fn(f32, f32, f32, f32, f32, *mut f32, u32) -> Hr;
}

// function pointers into a loaded DLL; callers serialise access with a mutex
unsafe impl Send for Tmsc {}

impl Tmsc {
    /// Read a DLL-allocated string and give the memory back.
    ///
    /// The Script Editor gets these as bare pointers, so their encoding isn't
    /// declared anywhere: a UTF-16 string of ASCII text has a zero second
    /// byte, an ANSI one doesn't. Both are handled.
    pub unsafe fn take_string(&self, p: Ptr) -> Option<String> {
        if p.is_null() {
            return None;
        }
        let b = p as *const u8;
        let s = if *b != 0 && *b.add(1) == 0 {
            let w = p as *const u16;
            let mut n = 0;
            while *w.add(n) != 0 && n < 4096 {
                n += 1;
            }
            String::from_utf16_lossy(std::slice::from_raw_parts(w, n))
        } else {
            let mut n = 0;
            while *b.add(n) != 0 && n < 4096 {
                n += 1;
            }
            String::from_utf8_lossy(std::slice::from_raw_parts(b, n)).into_owned()
        };
        (self.free)(p);
        Some(s)
    }

    /// A DLL-allocated array of u32 serial numbers, freed after reading.
    pub unsafe fn take_u32s(&self, p: Ptr, n: usize) -> Vec<u32> {
        if p.is_null() || n == 0 {
            return vec![];
        }
        let v = std::slice::from_raw_parts(p as *const u32, n.min(64)).to_vec();
        (self.free)(p);
        v
    }

    /// A readable message for an HRESULT, from the DLL itself when it knows.
    pub fn hr_text(&self, hr: Hr) -> String {
        let mut p: Ptr = std::ptr::null_mut();
        let known = unsafe { (self.help_get_hresult_string)(hr, &mut p) == 0 };
        let text = if known { unsafe { self.take_string(p) } } else { None };
        match text {
            Some(t) if !t.trim().is_empty() => format!("{} (0x{hr:08X})", t.trim()),
            _ => format!("0x{hr:08X}"),
        }
    }
}
