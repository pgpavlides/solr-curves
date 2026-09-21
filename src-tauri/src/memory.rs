/*
  How much RAM the app uses: this process plus everything it started - the
  WebView2 browser, renderer and GPU processes are its children and hold most
  of it. Counted as the private working set, the number Task Manager shows in
  its Memory column, so the two agree.
*/

use serde::Serialize;
use std::collections::HashMap;
use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX2};
use windows_sys::Win32::System::Threading::{GetCurrentProcessId, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};

#[derive(Serialize)]
pub struct Usage {
    /// everything together, in bytes
    pub total: u64,
    /// the app's own process (Rust: sound, T.A.R.G.E.T., the stick)
    pub app: u64,
    /// the WebView2 processes that draw the window
    pub webview: u64,
    pub processes: usize,
}

/// (pid, parent) of every process running
fn all_processes() -> Vec<(u32, u32)> {
    let mut out = Vec::new();
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE {
            return out;
        }
        let mut e = PROCESSENTRY32W { dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        if Process32FirstW(snap, &mut e) != 0 {
            loop {
                out.push((e.th32ProcessID, e.th32ParentProcessID));
                if Process32NextW(snap, &mut e) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snap);
    }
    out
}

fn private_working_set(pid: u32) -> u64 {
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return 0;
        }
        let mut c = PROCESS_MEMORY_COUNTERS_EX2 { cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX2>() as u32, ..std::mem::zeroed() };
        let ok = K32GetProcessMemoryInfo(h, &mut c as *mut _ as *mut PROCESS_MEMORY_COUNTERS, c.cb);
        CloseHandle(h);
        if ok != 0 { c.PrivateWorkingSetSize as u64 } else { 0 }
    }
}

pub fn usage() -> Usage {
    let me = unsafe { GetCurrentProcessId() };
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for (pid, parent) in all_processes() {
        // pid 0 is the idle process and its own parent: it would loop
        if pid != parent {
            children.entry(parent).or_default().push(pid);
        }
    }
    // everything below this process, however deep
    let mut below = Vec::new();
    let mut todo = children.get(&me).cloned().unwrap_or_default();
    while let Some(p) = todo.pop() {
        if below.contains(&p) {
            continue;
        }
        below.push(p);
        todo.extend(children.get(&p).cloned().unwrap_or_default());
    }
    let app = private_working_set(me);
    let webview: u64 = below.iter().map(|&p| private_working_set(p)).sum();
    Usage { total: app + webview, app, webview, processes: 1 + below.len() }
}
