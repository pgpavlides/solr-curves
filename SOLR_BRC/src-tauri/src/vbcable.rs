//! Repairing VB-CABLE, the virtual cable the voice sounds go out on.
//!
//! VB-CABLE is a kernel driver (VB-Audio's, signed). Windows can lose the
//! cable *device* while keeping the *driver* in its driver store - it happened
//! here on 19 Sep 2026, when the audio devices were re-enumerated. The repair
//! puts the device back from that stored driver, the way Microsoft's
//! `devcon install` does: create a root device with the cable's hardware id,
//! then install the driver on it. Nothing is downloaded or bundled.
//!
//! Installing a driver needs administrator rights, so the app starts itself
//! again elevated with `--repair-vbcable` (one Windows prompt), and that copy
//! does only this and exits.

use std::path::PathBuf;

/// From the driver's .inf: `HardwareId="VBAudioVACWDM"`, class MEDIA.
const HWID: &str = "VBAudioVACWDM";
pub const ARG: &str = "--repair-vbcable";

/// The cable driver's .inf in Windows' driver store, if it's there.
pub fn stored_inf() -> Option<PathBuf> {
    let repo = PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into()))
        .join(r"System32\DriverStore\FileRepository");
    std::fs::read_dir(&repo)
        .ok()?
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().to_lowercase().starts_with("vbmmecable64_win10.inf_"))
        .map(|e| e.path().join("vbmmecable64_win10.inf"))
        .find(|p| p.exists())
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(Some(0)).collect()
}

/// Is there a cable device (present, working or not) on the system?
#[cfg(windows)]
fn device_exists() -> bool {
    use windows_sys::Win32::Devices::DeviceAndDriverInstallation::*;
    unsafe {
        let set = SetupDiGetClassDevsW(&GUID_DEVCLASS_MEDIA, std::ptr::null(), std::ptr::null_mut(), DIGCF_PRESENT);
        if set == -1 {
            return false;
        }
        let mut found = false;
        let mut i = 0;
        loop {
            let mut d = SP_DEVINFO_DATA { cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32, ..Default::default() };
            if SetupDiEnumDeviceInfo(set, i, &mut d) == 0 {
                break;
            }
            i += 1;
            let mut buf = [0u16; 512];
            let mut kind = 0u32;
            if SetupDiGetDeviceRegistryPropertyW(set, &d, SPDRP_HARDWAREID, &mut kind, buf.as_mut_ptr() as *mut u8, (buf.len() * 2) as u32, std::ptr::null_mut()) != 0 {
                // a list of strings; the first is enough here
                let n = buf.iter().position(|&c| c == 0).unwrap_or(0);
                if String::from_utf16_lossy(&buf[..n]).eq_ignore_ascii_case(HWID) {
                    found = true;
                    break;
                }
            }
        }
        SetupDiDestroyDeviceInfoList(set);
        found
    }
}

/// The elevated part: (re)create the cable device and install the stored driver on it.
#[cfg(windows)]
fn repair_elevated() -> Result<(), String> {
    use windows_sys::Win32::Devices::DeviceAndDriverInstallation::*;
    let inf = stored_inf().ok_or("the VB-CABLE driver isn't in Windows' driver store")?;
    let inf_w = wide(&inf.to_string_lossy());
    let hwid_w = wide(HWID);
    unsafe {
        if !device_exists() {
            let set = SetupDiCreateDeviceInfoList(&GUID_DEVCLASS_MEDIA, std::ptr::null_mut());
            if set == -1 {
                return Err(format!("SetupDiCreateDeviceInfoList: {}", std::io::Error::last_os_error()));
            }
            let mut d = SP_DEVINFO_DATA { cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32, ..Default::default() };
            let class = wide("MEDIA");
            let mut ok = SetupDiCreateDeviceInfoW(set, class.as_ptr(), &GUID_DEVCLASS_MEDIA, std::ptr::null(), std::ptr::null_mut(), DICD_GENERATE_ID, &mut d) != 0;
            // hardware id = a double-NUL-terminated string list
            let mut list = hwid_w.clone();
            list.push(0);
            ok = ok && SetupDiSetDeviceRegistryPropertyW(set, &mut d, SPDRP_HARDWAREID, list.as_ptr() as *const u8, (list.len() * 2) as u32) != 0;
            ok = ok && SetupDiCallClassInstaller(DIF_REGISTERDEVICE, set, &d) != 0;
            let err = std::io::Error::last_os_error();
            SetupDiDestroyDeviceInfoList(set);
            if !ok {
                return Err(format!("creating the cable device: {err}"));
            }
        }
        let mut reboot = 0;
        if UpdateDriverForPlugAndPlayDevicesW(std::ptr::null_mut(), hwid_w.as_ptr(), inf_w.as_ptr(), INSTALLFLAG_FORCE, &mut reboot) == 0 {
            return Err(format!("installing the driver: {}", std::io::Error::last_os_error()));
        }
        if reboot != 0 {
            return Err("installed - Windows wants a restart before the cable works".into());
        }
    }
    Ok(())
}

/// Called from main() before anything else: when started with ARG, repair and
/// exit (0 = done; the reason goes to the file named after ARG).
pub fn run_if_asked() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some(ARG) {
        return;
    }
    let result = repair_elevated();
    if let (Some(out), Err(e)) = (args.get(2), &result) {
        let _ = std::fs::write(out, e);
    }
    std::process::exit(if result.is_ok() { 0 } else { 1 });
}

/// From the app: start the elevated copy and wait for it. Windows asks once.
pub fn repair() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let report = std::env::temp_dir().join("solr-vbcable-repair.txt");
    let _ = std::fs::remove_file(&report);
    let ps = format!(
        "$p = Start-Process -FilePath '{}' -ArgumentList '{ARG}','\"{}\"' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode",
        exe.display().to_string().replace('\'', "''"),
        report.display()
    );
    let mut cmd = std::process::Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", &ps]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let status = cmd.status().map_err(|e| e.to_string())?;
    if status.success() {
        return Ok(());
    }
    Err(std::fs::read_to_string(&report)
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Windows didn't run the repair (the admin prompt was declined?)".into()))
}
