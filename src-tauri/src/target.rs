//! Running the T.A.R.G.E.T. script from inside the app, no Script Editor.
//!
//! T.A.R.G.E.T. scripts don't run in the editor: they run in Thrustmaster's
//! "FAST" Windows service (TmWinService, always on). The editor is a client
//! that drives it through TmServiceControl.dll. This module is the same client.
//!
//! The call sequence and signatures are the Script Editor's own, read from its
//! .NET metadata (P/Invoke declarations) and the IL of its Run/Stop handlers:
//!
//!   start-up  TmSCInitializeControl, TmSCSetMessageCallback,
//!             TmSCScriptSendFolderPath(i, dir)... then (n, "") to end the list,
//!             TmSCScriptSendLoadPluginDirectory(<TARGET>\Plugins\)
//!   Run       TmSCScriptLoad(path), TmSCScriptSendParams("main"),
//!             TmSCScriptCompile(), TmSCScriptRunAsync(timeout)
//!   Stop      TmSCScriptStop()
//!   close     TmSCSetMessageCallback(null), TmSCServiceSetStopOnClientClose,
//!             TmSCUnInitialize
//!
//! Strings to the service are UTF-16. The message callback's text is ANSI (the
//! .NET delegate declares a plain String with no marshalling attribute).

use libloading::os::windows::{Library, LOAD_WITH_ALTERED_SEARCH_PATH};
use serde::Serialize;
use std::collections::VecDeque;
use std::ffi::{c_char, c_void, CStr};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

type Hr = u32;
type MsgCb = unsafe extern "system" fn(*mut c_void, *const c_char, i32) -> i32;

pub const TARGET_DIR: &str = r"C:\Program Files (x86)\Thrustmaster\TARGET";
const RUN_TIMEOUT_MS: u32 = 60_000; // the editor's default RunTimeout

/// The script this app drives, compiled into the app so the two can't drift.
pub const SCRIPT: &str = include_str!("../../target/hotas_wardogs_solr.tmc");
pub const SCRIPT_NAME: &str = "hotas_wardogs_solr.tmc";

// enTmOutputType_t
const MSG_SCRIPT: i32 = 0;
const MSG_ERROR: i32 = 1;
const MSG_ERROR_COMPILE: i32 = 2;
const MSG_WARNING: i32 = 3;
const MSG_STATUS: i32 = 256; // msgNotifScriptStatusUpdate

struct Api {
    _lib: Library,
    initialize: unsafe extern "system" fn() -> Hr,
    uninitialize: unsafe extern "system" fn() -> Hr,
    set_message_callback: unsafe extern "system" fn(Option<MsgCb>, *mut c_void) -> Hr,
    stop_on_client_close: unsafe extern "system" fn(u8) -> Hr,
    send_folder_path: unsafe extern "system" fn(i32, *const u16) -> Hr,
    plugin_directory: unsafe extern "system" fn(*const u16) -> Hr,
    load: unsafe extern "system" fn(*const u16) -> Hr,
    send_params: unsafe extern "system" fn(*const u16) -> Hr,
    compile: unsafe extern "system" fn() -> Hr,
    run_async: unsafe extern "system" fn(u32) -> Hr,
    stop: unsafe extern "system" fn() -> Hr,
    is_running: unsafe extern "system" fn(*mut u8) -> Hr,
    is_pending: unsafe extern "system" fn(*mut u8) -> Hr,
}

// function pointers into a loaded DLL; every call goes through the mutex below
unsafe impl Send for Api {}

static API: Mutex<Option<Api>> = Mutex::new(None);
static APP: OnceLock<AppHandle> = OnceLock::new();

#[derive(Clone, Serialize)]
pub struct LogLine {
    pub kind: &'static str, // script | error | compile | warning | info
    pub text: String,
}

struct Log {
    lines: VecDeque<LogLine>,
    partial: String, // the script prints with putchar: text arrives in pieces
    compile_errors: usize,
}
static LOG: Mutex<Log> = Mutex::new(Log { lines: VecDeque::new(), partial: String::new(), compile_errors: 0 });

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn push_line(kind: &'static str, text: String) {
    let line = LogLine { kind, text };
    {
        let mut log = LOG.lock().unwrap();
        log.lines.push_back(line.clone());
        while log.lines.len() > 400 {
            log.lines.pop_front();
        }
    }
    if let Some(app) = APP.get() {
        let _ = app.emit("solr:target-log", line);
    }
}

unsafe extern "system" fn on_message(_param: *mut c_void, msg: *const c_char, kind: i32) -> i32 {
    if msg.is_null() {
        return 0;
    }
    let text = CStr::from_ptr(msg).to_string_lossy().into_owned();
    if kind == MSG_STATUS {
        if let Some(app) = APP.get() {
            let _ = app.emit("solr:target-status", ());
        }
        return 0;
    }
    let tag: &'static str = match kind {
        MSG_SCRIPT => "script",
        MSG_ERROR => "error",
        MSG_ERROR_COMPILE => "compile",
        MSG_WARNING => "warning",
        _ => "info",
    };
    if kind == MSG_ERROR_COMPILE {
        LOG.lock().unwrap().compile_errors += 1;
    }
    // join fragments into lines (the service sends "\n" as its own piece, and
    // putchar output one character at a time)
    let done: Vec<String> = {
        let mut log = LOG.lock().unwrap();
        log.partial.push_str(&text.replace('\r', ""));
        let mut out = vec![];
        while let Some(i) = log.partial.find('\n') {
            let l: String = log.partial.drain(..=i).collect();
            out.push(l.trim_end().to_string());
        }
        out
    };
    for l in done.into_iter().filter(|l| !l.trim().is_empty()) {
        push_line(tag, l);
    }
    0
}

fn dll_path() -> PathBuf {
    Path::new(TARGET_DIR).join(r"x64\TmServiceControl.dll")
}

/// Load the DLL and register as a client (once).
fn ensure(app: &AppHandle) -> Result<(), String> {
    let _ = APP.set(app.clone());
    let mut guard = API.lock().unwrap();
    if guard.is_some() {
        return Ok(());
    }
    let path = dll_path();
    if !path.exists() {
        return Err(format!("T.A.R.G.E.T. is not installed ({} not found)", path.display()));
    }
    unsafe {
        // altered search path: its own dependencies sit next to it in x64\
        let lib = Library::load_with_flags(&path, LOAD_WITH_ALTERED_SEARCH_PATH).map_err(|e| e.to_string())?;
        macro_rules! f {
            ($name:literal) => {
                *lib.get(concat!($name, "\0").as_bytes()).map_err(|e| format!("{}: {e}", $name))?
            };
        }
        let api = Api {
            initialize: f!("TmSCInitializeControl"),
            uninitialize: f!("TmSCUnInitialize"),
            set_message_callback: f!("TmSCSetMessageCallback"),
            stop_on_client_close: f!("TmSCServiceSetStopOnClientClose"),
            send_folder_path: f!("TmSCScriptSendFolderPath"),
            plugin_directory: f!("TmSCScriptSendLoadPluginDirectory"),
            load: f!("TmSCScriptLoad"),
            send_params: f!("TmSCScriptSendParams"),
            compile: f!("TmSCScriptCompile"),
            run_async: f!("TmSCScriptRunAsync"),
            stop: f!("TmSCScriptStop"),
            is_running: f!("TmSCScriptGetIsRunning"),
            is_pending: f!("TmSCScriptGetIsPending"),
            _lib: lib,
        };
        let hr = (api.initialize)();
        if hr != 0 {
            return Err(format!("Can't reach the T.A.R.G.E.T. service (TmSCInitializeControl 0x{hr:08X}). Is \"Thrustmaster FAST service\" running?"));
        }
        (api.set_message_callback)(Some(on_message), std::ptr::null_mut());
        // closing this app stops the script, like the editor's default
        (api.stop_on_client_close)(1);
        *guard = Some(api);
    }
    Ok(())
}

fn with_api<T>(f: impl FnOnce(&Api) -> T) -> Result<T, String> {
    let guard = API.lock().unwrap();
    guard.as_ref().map(f).ok_or_else(|| "T.A.R.G.E.T. not connected".to_string())
}

/// Alive = running OR pending, as the Script Editor decides its Run/Stop
/// buttons. "Running" is only while main() executes; afterwards the script
/// lives on handling stick events, which the service calls "pending".
fn alive(a: &Api) -> bool {
    let (mut r, mut p) = (0u8, 0u8);
    unsafe {
        (a.is_running)(&mut r);
        (a.is_pending)(&mut p);
    }
    r != 0 || p != 0
}

fn running() -> bool {
    with_api(alive).unwrap_or(false)
}

/// Keep the script on disk identical to the one built into the app.
/// A different file there is kept as .bak, never silently lost.
fn install_script(dir: &Path) -> Result<PathBuf, String> {
    let path = dir.join(SCRIPT_NAME);
    let want = SCRIPT.replace("\r\n", "\n").replace('\n', "\r\n");
    match std::fs::read_to_string(&path) {
        Ok(have) if have.replace("\r\n", "\n") == SCRIPT.replace("\r\n", "\n") => return Ok(path),
        Ok(_) => {
            let _ = std::fs::copy(&path, path.with_extension("tmc.bak"));
        }
        Err(_) => {}
    }
    std::fs::write(&path, want).map_err(|e| format!("write {}: {e}", path.display()))?;
    push_line("info", format!("Installed {} (from the app)", path.display()));
    Ok(path)
}

#[derive(Serialize)]
pub struct Status {
    pub available: bool,
    pub connected: bool,
    pub running: bool,
    pub script: String,
    pub error: Option<String>,
}

pub fn status(app: &AppHandle, dir: &Path) -> Status {
    let script = dir.join(SCRIPT_NAME).to_string_lossy().into_owned();
    if !dll_path().exists() {
        return Status { available: false, connected: false, running: false, script, error: Some("T.A.R.G.E.T. is not installed".into()) };
    }
    match ensure(app) {
        Ok(()) => Status { available: true, connected: true, running: running(), script, error: None },
        Err(e) => Status { available: true, connected: false, running: false, script, error: Some(e) },
    }
}

/// Install, compile and run the script. Stops whatever script was running
/// first (including one started from the Script Editor).
pub fn start(app: &AppHandle, dir: &Path) -> Result<(), String> {
    ensure(app)?;
    let path = install_script(dir)?;
    let script_dir = path.parent().unwrap().to_string_lossy().into_owned();
    let scripts = Path::new(TARGET_DIR).join("Scripts").to_string_lossy().into_owned();
    let plugins = format!(r"{}\Plugins\", TARGET_DIR);
    let path_w = wide(&path.to_string_lossy());
    push_line("info", format!("Starting {}", path.display()));
    with_api(|a| -> Result<(), String> {
        unsafe {
            if alive(a) {
                (a.stop)();
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
            // include folders, as the editor sends them: the script's own
            // folder ({current}), T.A.R.G.E.T.'s Scripts, then "" to end
            (a.send_folder_path)(0, wide(&script_dir).as_ptr());
            (a.send_folder_path)(1, wide(&scripts).as_ptr());
            (a.send_folder_path)(2, wide("").as_ptr());
            (a.plugin_directory)(wide(&plugins).as_ptr());
            LOG.lock().unwrap().compile_errors = 0;
            let hr = (a.load)(path_w.as_ptr());
            if hr != 0 {
                return Err(format!("TmSCScriptLoad failed (0x{hr:08X})"));
            }
            (a.send_params)(wide("main").as_ptr());
            let hr = (a.compile)();
            let errors = LOG.lock().unwrap().compile_errors;
            if hr != 0 || errors > 0 {
                return Err(format!("Compile failed (0x{hr:08X}, {errors} error line(s)) - see the log"));
            }
            let hr = (a.run_async)(RUN_TIMEOUT_MS);
            if hr != 0 {
                return Err(format!("TmSCScriptRunAsync failed (0x{hr:08X})"));
            }
        }
        Ok(())
    })??;
    Ok(())
}

pub fn stop(app: &AppHandle) -> Result<(), String> {
    ensure(app)?;
    with_api(|a| unsafe { (a.stop)() })?;
    push_line("info", "Script stopped".into());
    Ok(())
}

pub fn log() -> Vec<LogLine> {
    LOG.lock().unwrap().lines.iter().cloned().collect()
}

/// App exit: stop the script and let go of the service, like the editor.
pub fn shutdown() {
    if let Ok(mut guard) = API.lock() {
        if let Some(a) = guard.take() {
            unsafe {
                (a.stop)();
                (a.set_message_callback)(None, std::ptr::null_mut());
                (a.stop_on_client_close)(1);
                (a.uninitialize)();
            }
        }
    }
}
