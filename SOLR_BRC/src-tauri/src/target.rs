//! Running T.A.R.G.E.T. scripts from inside the app, no Script Editor.
//!
//! T.A.R.G.E.T. scripts don't run in the editor: they run in Thrustmaster's
//! "FAST" Windows service (TmWinService, always on). The editor is a client
//! that drives it through TmServiceControl.dll (bound in tmsc.rs). This module
//! is the same client, and the one connection every other part of the app
//! (devices.rs) shares.
//!
//! The call sequence is the Script Editor's own, read from the IL of its
//! Run/Stop handlers:
//!
//!   start-up  TmSCInitializeControl, TmSCSetMessageCallback,
//!             TmSCScriptSendFolderPath(i, dir)... then (n, "") to end the list,
//!             TmSCScriptSendLoadPluginDirectory(<TARGET>\Plugins\)
//!   Compile   TmSCScriptLoad(path), TmSCScriptSendParams("main"), TmSCScriptCompile()
//!   Run       ...then TmSCScriptRunAsync(timeout)
//!   Stop      TmSCScriptStop()
//!   close     TmSCSetMessageCallback(null), TmSCServiceSetStopOnClientClose,
//!             TmSCUnInitialize
//!
//! The message callback's text is ANSI (the .NET delegate declares a plain
//! String with no marshalling attribute).

use crate::tmsc::{self, wide, Tmsc, TARGET_DIR};
use serde::Serialize;
use std::collections::VecDeque;
use std::ffi::{c_char, c_void, CStr};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

const RUN_TIMEOUT_MS: u32 = 60_000; // the editor's default RunTimeout

/// The curve script this app drives, compiled into the app so the two can't drift.
pub const SCRIPT: &str = include_str!("../../target/hotas_wardogs_solr.tmc");
pub const SCRIPT_NAME: &str = "hotas_wardogs_solr.tmc";

// enTmOutputType_t
const MSG_SCRIPT: i32 = 0;
const MSG_ERROR: i32 = 1;
const MSG_ERROR_COMPILE: i32 = 2;
const MSG_WARNING: i32 = 3;
const MSG_STATUS: i32 = 256; // msgNotifScriptStatusUpdate

static CLIENT: Mutex<Option<Tmsc>> = Mutex::new(None);
static APP: OnceLock<AppHandle> = OnceLock::new();
/// The script file the service currently has loaded (for the status badge).
static CURRENT: Mutex<Option<String>> = Mutex::new(None);

#[derive(Clone, Serialize)]
pub struct LogLine {
    pub kind: &'static str, // script | error | compile | warning | info
    pub text: String,
}

struct Log {
    lines: VecDeque<LogLine>,
    partial: String, // the script prints with putchar: text arrives in pieces
    compile_errors: Vec<String>,
}
static LOG: Mutex<Log> = Mutex::new(Log { lines: VecDeque::new(), partial: String::new(), compile_errors: Vec::new() });

pub fn push_line(kind: &'static str, text: String) {
    let line = LogLine { kind, text };
    {
        let mut log = LOG.lock().unwrap();
        log.lines.push_back(line.clone());
        while log.lines.len() > 600 {
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
        if kind == MSG_ERROR_COMPILE {
            log.compile_errors.extend(out.iter().filter(|l| !l.trim().is_empty()).cloned());
        }
        out
    };
    for l in done.into_iter().filter(|l| !l.trim().is_empty()) {
        push_line(tag, l);
    }
    0
}

/// Load the DLL and register as a client (once), then run `f` with it.
pub fn with_client<T>(app: &AppHandle, f: impl FnOnce(&Tmsc) -> T) -> Result<T, String> {
    let _ = APP.set(app.clone());
    // with the service down, TmSCInitializeControl never returns: registering
    // then would hang this thread and, through the lock, everyone after it
    if CLIENT.lock().unwrap().is_none() && !service_running() {
        return Err("service-stopped".into());
    }
    let mut guard = CLIENT.lock().unwrap();
    if guard.is_none() {
        let c = Tmsc::load()?;
        let hr = unsafe { (c.initialize_control)() };
        if hr != 0 {
            return Err(format!(
                "Can't reach the T.A.R.G.E.T. service ({}). Is \"Thrustmaster FAST service\" running?",
                c.hr_text(hr)
            ));
        }
        unsafe {
            (c.set_message_callback)(Some(on_message), std::ptr::null_mut());
            // closing this app stops the script, like the editor's default
            (c.stop_on_client_close)(1);
        }
        *guard = Some(c);
    }
    Ok(f(guard.as_ref().unwrap()))
}

/// Alive = running OR pending, as the Script Editor decides its Run/Stop
/// buttons. "Running" is only while main() executes; afterwards the script
/// lives on handling stick events, which the service calls "pending".
fn alive(c: &Tmsc) -> bool {
    let (mut r, mut p) = (0u8, 0u8);
    unsafe {
        (c.script_get_is_running)(&mut r);
        (c.script_get_is_pending)(&mut p);
    }
    r != 0 || p != 0
}

/// Keep the curve script on disk identical to the one built into the app.
/// A different file there is kept as .bak, never silently lost.
pub fn install_builtin(dir: &Path) -> Result<PathBuf, String> {
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

/*
  Thrustmaster's service itself. It runs every script; if it isn't running,
  nothing works - and the DLL doesn't say so (the client stays "connected" to
  a service that is gone). It has crashed under low memory before (exit code
  1067), so the app checks it directly and can start it again.
*/
pub const SERVICE: &str = "TmWinService";

fn hidden(cmd: &str) -> std::process::Command {
    let mut c = std::process::Command::new(cmd);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c
}

/// `sc query` works without admin rights.
pub fn service_running() -> bool {
    hidden("sc")
        .args(["query", SERVICE])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("RUNNING"))
        .unwrap_or(false)
}

/// Starting a service needs admin: ask Windows to elevate (UAC prompt).
/// Returns once the prompt is answered.
pub fn start_service() -> Result<(), String> {
    let ok = hidden("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("Start-Process sc.exe -ArgumentList 'start','{SERVICE}' -Verb RunAs -WindowStyle Hidden -Wait"),
        ])
        .status()
        .map_err(|e| e.to_string())?
        .success();
    if !ok {
        return Err("Windows didn't start it (the admin prompt was declined?)".into());
    }
    for _ in 0..40 {
        if service_running() {
            push_line("info", "Thrustmaster FAST service started".into());
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
    Err("The service didn't come up".into())
}

/// A client registered with a service that has since died is useless: drop
/// it, so the next call registers afresh with the new service.
fn drop_client() {
    // try_lock: a call stuck waiting on the dead service may hold the lock;
    // never wait behind it (the next status check tries again)
    if let Ok(mut guard) = CLIENT.try_lock() {
        if let Some(c) = guard.take() {
            unsafe {
                (c.set_message_callback)(None, std::ptr::null_mut());
                (c.uninitialize)();
            }
        }
    }
}

pub fn status(app: &AppHandle, dir: &Path) -> Status {
    let script = CURRENT.lock().unwrap().clone().unwrap_or_else(|| dir.join(SCRIPT_NAME).to_string_lossy().into_owned());
    if !tmsc::dll_path().exists() {
        return Status { available: false, connected: false, running: false, script, error: Some("T.A.R.G.E.T. is not installed".into()) };
    }
    if !service_running() {
        drop_client();
        return Status {
            available: true,
            connected: false,
            running: false,
            script,
            error: Some("service-stopped".into()),
        };
    }
    match with_client(app, alive) {
        Ok(running) => Status { available: true, connected: true, running, script, error: None },
        Err(e) => Status { available: true, connected: false, running: false, script, error: Some(e) },
    }
}

#[derive(Serialize, Default)]
pub struct CompileResult {
    pub ok: bool,
    /// "Compile error: ..., in <file>, at line N" lines, as the service prints them
    pub errors: Vec<String>,
    pub functions: Vec<String>,
    pub variables: Vec<String>,
    pub defines: Vec<String>,
}

/// Load + compile a script file. Stops a running script first (the service
/// holds one script at a time). With `run`, starts it when it compiled.
pub fn compile_file(app: &AppHandle, path: &Path, run: bool) -> Result<CompileResult, String> {
    let script_dir = path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    let scripts = Path::new(TARGET_DIR).join("Scripts").to_string_lossy().into_owned();
    let plugins = format!(r"{}\Plugins\", TARGET_DIR);
    push_line("info", format!("{} {}", if run { "Starting" } else { "Compiling" }, path.display()));
    let result = with_client(app, |c| -> Result<CompileResult, String> {
        unsafe {
            if alive(c) {
                (c.script_stop)();
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
            // include folders, as the editor sends them: the script's own
            // folder ({current}), T.A.R.G.E.T.'s Scripts, then "" to end
            (c.script_send_folder_path)(0, wide(&script_dir).as_ptr());
            (c.script_send_folder_path)(1, wide(&scripts).as_ptr());
            (c.script_send_folder_path)(2, wide("").as_ptr());
            (c.script_send_load_plugin_directory)(wide(&plugins).as_ptr());
            LOG.lock().unwrap().compile_errors.clear();
            let hr = (c.script_load)(wide(&path.to_string_lossy()).as_ptr());
            if hr != 0 {
                return Err(format!("Couldn't load the script: {}", c.hr_text(hr)));
            }
            (c.script_send_params)(wide("main").as_ptr());
            let hr = (c.script_compile)();
            // the error text ("; expected in <file> at line N") is delivered
            // through the message callback just AFTER compile returns: give
            // it a moment to land before reading it
            if hr != 0 {
                for _ in 0..20 {
                    if !LOG.lock().unwrap().compile_errors.is_empty() {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(25));
                }
            }
            let errors = LOG.lock().unwrap().compile_errors.clone();
            let mut res = CompileResult { ok: hr == 0 && errors.is_empty(), errors, ..Default::default() };
            if !res.ok {
                if res.errors.is_empty() {
                    res.errors.push(format!("Compile failed: {}", c.hr_text(hr)));
                }
                return Ok(res);
            }
            res.functions = list(c, c.script_get_function_list);
            res.variables = list(c, c.script_get_variable_list);
            res.defines = list(c, c.script_get_defines_list);
            if run {
                let hr = (c.script_run_async)(RUN_TIMEOUT_MS);
                if hr != 0 {
                    return Err(format!("Couldn't run the script: {}", c.hr_text(hr)));
                }
            }
            Ok(res)
        }
    })??;
    if result.ok && run {
        *CURRENT.lock().unwrap() = Some(path.to_string_lossy().into_owned());
    }
    Ok(result)
}

/// One of the DLL's name lists (functions / variables / defines): a single
/// space-separated string. Its end isn't cleanly terminated, so reading stops
/// at the first token that isn't a name.
unsafe fn list(c: &Tmsc, f: unsafe extern "system" fn(*mut tmsc::Ptr) -> tmsc::Hr) -> Vec<String> {
    let mut p: tmsc::Ptr = std::ptr::null_mut();
    if f(&mut p) != 0 {
        return vec![];
    }
    let Some(s) = c.take_string(p) else { return vec![] };
    let is_name = |x: &str| {
        let mut ch = x.chars();
        matches!(ch.next(), Some(c0) if c0.is_ascii_alphabetic() || c0 == '_')
            && ch.all(|c| c.is_ascii_alphanumeric() || c == '_')
    };
    let mut v: Vec<String> = s.split_whitespace().take_while(|x| is_name(x)).map(str::to_string).collect();
    v.sort();
    v.dedup();
    v
}

/// Compile a script without running it. The service holds one script, so a
/// check replaces whatever was running - which is then compiled and started
/// again, so checking a script never leaves the stick unprocessed.
pub fn check_file(app: &AppHandle, path: &Path) -> Result<CompileResult, String> {
    let prev = if with_client(app, alive)? { CURRENT.lock().unwrap().clone() } else { None };
    let res = compile_file(app, path, false);
    if let Some(p) = prev {
        match compile_file(app, Path::new(&p), true) {
            Ok(r) if r.ok => push_line("info", format!("Back to {p}")),
            _ => push_line("error", format!("Couldn't restart {p} after the check")),
        }
    }
    res
}

/// The curve script: install the built-in copy, then compile and run it.
pub fn start(app: &AppHandle, dir: &Path) -> Result<(), String> {
    let path = install_builtin(dir)?;
    let r = compile_file(app, &path, true)?;
    if !r.ok {
        return Err(format!("Compile failed - {}", r.errors.first().cloned().unwrap_or_default()));
    }
    Ok(())
}

pub fn stop(app: &AppHandle) -> Result<(), String> {
    with_client(app, |c| unsafe { (c.script_stop)() })?;
    push_line("info", "Script stopped".into());
    Ok(())
}

pub fn log() -> Vec<LogLine> {
    LOG.lock().unwrap().lines.iter().cloned().collect()
}

/// App exit: stop the script and let go of the service, like the editor.
pub fn shutdown() {
    if let Ok(mut guard) = CLIENT.lock() {
        if let Some(c) = guard.take() {
            unsafe {
                (c.script_stop)();
                (c.set_message_callback)(None, std::ptr::null_mut());
                (c.stop_on_client_close)(1);
                (c.uninitialize)();
            }
        }
    }
}
