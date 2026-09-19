//! Audio device discovery.
//!
//! The app never creates a microphone — on Windows only a kernel-mode driver
//! can publish a capture endpoint. Instead we render into the Voicemeeter VAIO
//! input, whose driver already publishes real capture endpoints ("Voicemeeter
//! Out B1" etc.) that Discord, FiveM and anything else can select as their mic.

use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

/// Name fragments identifying a virtual cable we can feed a "mic" through.
const VIRTUAL_SINK_HINTS: &[&str] = &["voicemeeter", "vb-audio", "cable input", "vb-cable"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    /// Stable identifier, round-trips via Display/FromStr. Persist this, not the name.
    pub id: String,
    /// Human-readable name for the UI.
    pub name: String,
    pub default_rate: u32,
    pub default_channels: u16,
    /// True when this looks like a virtual cable, i.e. a valid "virtual mic" target.
    pub is_virtual_sink: bool,
    pub is_default: bool,
}

fn looks_virtual(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    VIRTUAL_SINK_HINTS.iter().any(|h| lower.contains(h))
}

fn describe(device: &cpal::Device, output: bool, default_id: &str) -> Option<DeviceInfo> {
    let name = device.description().ok()?.name().to_string();
    // An endpoint can be listed but unusable (unplugged, or held exclusively by
    // another process); asking for its default config is the cheapest probe.
    let cfg = if output {
        device.default_output_config().ok()?
    } else {
        device.default_input_config().ok()?
    };
    let id = device.id().map(|i| i.to_string()).unwrap_or_default();
    Some(DeviceInfo {
        is_virtual_sink: looks_virtual(&name),
        is_default: !id.is_empty() && id == default_id,
        default_rate: cfg.sample_rate(),
        default_channels: cfg.channels(),
        id,
        name,
    })
}

fn default_id(host: &cpal::Host, output: bool) -> String {
    let dev = if output {
        host.default_output_device()
    } else {
        host.default_input_device()
    };
    dev.and_then(|d| d.id().ok())
        .map(|i| i.to_string())
        .unwrap_or_default()
}

/// All usable playback endpoints, virtual cables listed first.
pub fn list_outputs() -> Result<Vec<DeviceInfo>> {
    let host = cpal::default_host();
    let def = default_id(&host, true);
    let mut out: Vec<DeviceInfo> = host
        .output_devices()?
        .filter_map(|d| describe(&d, true, &def))
        .collect();
    // Virtual cables first — that is what the user must pick for the mic path.
    out.sort_by(|a, b| {
        b.is_virtual_sink
            .cmp(&a.is_virtual_sink)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(out)
}

/// All usable capture endpoints, for the optional live-mic passthrough.
pub fn list_inputs() -> Result<Vec<DeviceInfo>> {
    let host = cpal::default_host();
    let def = default_id(&host, false);
    let mut out: Vec<DeviceInfo> = host
        .input_devices()?
        .filter_map(|d| describe(&d, false, &def))
        .collect();
    out.sort_by(|a, b| {
        b.is_default
            .cmp(&a.is_default)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(out)
}

/// Resolve a device by persisted id, falling back to name, then to the default.
/// Name fallback matters because ids can change when Windows re-enumerates USB gear.
fn resolve(devices: impl Iterator<Item = cpal::Device>, key: &str) -> Option<cpal::Device> {
    let mut by_name = None;
    for d in devices {
        if d.id().ok().map(|i| i.to_string()).as_deref() == Some(key) {
            return Some(d);
        }
        if by_name.is_none() && d.description().ok().map(|x| x.name().to_string()).as_deref() == Some(key) {
            by_name = Some(d);
        }
    }
    by_name
}

pub fn output_by_key(key: Option<&str>) -> Result<cpal::Device> {
    let host = cpal::default_host();
    match key {
        Some(k) => resolve(host.output_devices()?, k)
            .ok_or_else(|| anyhow!("playback device not found: {k}")),
        None => host
            .default_output_device()
            .ok_or_else(|| anyhow!("no default playback device")),
    }
}

pub fn input_by_key(key: Option<&str>) -> Result<cpal::Device> {
    let host = cpal::default_host();
    match key {
        Some(k) => {
            resolve(host.input_devices()?, k).ok_or_else(|| anyhow!("capture device not found: {k}"))
        }
        None => host
            .default_input_device()
            .ok_or_else(|| anyhow!("no default capture device")),
    }
}

/// How good a "virtual mic" target an endpoint looks. Higher wins.
///
/// Plain alphabetical order picked "CABLE In 16ch" over "CABLE Input", and the
/// 16-channel endpoint cannot even be opened at its default config, so the
/// preference is explicit rather than incidental.
fn sink_rank(name: &str) -> i32 {
    let l = name.to_ascii_lowercase();
    if l.contains("cable input") {
        3 // the plain 2-channel VB-CABLE input: measured working
    } else if l.contains("voicemeeter") || l.contains("vb-audio") {
        2
    } else if l.contains("cable in") {
        1 // multichannel variants; opening these usually fails
    } else {
        0
    }
}

/// Best guess at the virtual cable to feed, so first run can preselect it.
/// Only a guess - `audio::verify` is what actually proves the path.
pub fn suggested_virtual_sink() -> Option<DeviceInfo> {
    list_outputs()
        .ok()?
        .into_iter()
        .filter(|d| d.is_virtual_sink)
        .max_by_key(|d| sink_rank(&d.name))
}

/// Interfaces the operator actually listens through, most preferred first.
/// The Focusrite is this rig's monitoring path, so it wins outright.
const MONITOR_PREFERENCE: &[&str] = &["focusrite"];

/// Best guess at a local monitor device: a real speaker, never a virtual cable.
///
/// Never falls back to "the Windows default" blindly - VB-CABLE installs itself
/// as the default output, and monitoring into the same cable we transmit on
/// would double every clip back into the game.
pub fn suggested_monitor() -> Option<DeviceInfo> {
    let outs = list_outputs().ok()?;
    let real = || outs.iter().filter(|d| !d.is_virtual_sink);

    for want in MONITOR_PREFERENCE {
        if let Some(d) = real().find(|d| d.name.to_ascii_lowercase().contains(want)) {
            return Some(d.clone());
        }
    }
    real()
        .find(|d| d.is_default)
        .or_else(|| real().next())
        .cloned()
}
