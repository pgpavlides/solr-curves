//! Offline format conversion: get a decoded clip onto the output device's
//! sample rate and channel count once, at load time, so the audio callback
//! only ever does adds and multiplies.
//!
//! Every clip in this library is 44100 Hz mono while the Voicemeeter VAIO
//! runs at 48000 Hz stereo, so this path is always exercised.

use anyhow::{anyhow, Result};
use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Fft, FixedSync, Resampler};

use super::decode::Clip;

/// A clip converted to the device's rate and channel count, interleaved.
#[derive(Debug)]
pub struct Prepared {
    pub samples: Vec<f32>,
    pub channels: usize,
}

impl Prepared {
    pub fn frames(&self) -> usize {
        if self.channels == 0 {
            0
        } else {
            self.samples.len() / self.channels
        }
    }
}

/// Band-limited rate conversion. `Fft` is used rather than a sinc interpolator
/// because 44.1k -> 48k is an exact 147:160 ratio, which the FFT resampler
/// handles both faster and more cleanly than an asynchronous one.
fn resample(samples: &[f32], channels: usize, from: u32, to: u32) -> Result<Vec<f32>> {
    if from == to {
        return Ok(samples.to_vec());
    }
    let frames = samples.len() / channels;
    if frames == 0 {
        return Ok(Vec::new());
    }

    let mut rs = Fft::<f32>::new(from as usize, to as usize, 1024, channels, FixedSync::Input)
        .map_err(|e| anyhow!("resampler construction failed: {e}"))?;

    let input = InterleavedSlice::new(samples, channels, frames)
        .map_err(|e| anyhow!("input adapter: {e}"))?;

    let out = rs
        .process_all(&input, frames, None)
        .map_err(|e| anyhow!("resampling failed: {e}"))?;

    Ok(out.take_data())
}

/// Spread or fold channels to match the device.
/// Mono -> stereo duplicates; anything wider is averaged down or padded.
fn map_channels(samples: &[f32], from: usize, to: usize) -> Vec<f32> {
    if from == to {
        return samples.to_vec();
    }
    let frames = samples.len() / from;
    let mut out = Vec::with_capacity(frames * to);
    for f in 0..frames {
        let src = &samples[f * from..f * from + from];
        if from == 1 {
            // The common case here: one mono voice clip fanned to every channel.
            out.extend(std::iter::repeat(src[0]).take(to));
        } else {
            for c in 0..to {
                // Reuse the last source channel rather than emitting silence,
                // so a stereo clip on a >2ch device stays audible.
                out.push(src[c.min(from - 1)]);
            }
        }
    }
    out
}

/// Peak every clip lands on, leaving headroom below the mixer's hard clamp.
///
/// TTS output varies widely in level - this library spans 0.36 to 0.95 peak for
/// the same voice and settings - and the quiet end sits near or below a voice
/// chat's activation threshold, so those clips get gated away while louder ones
/// transmit. Normalising removes level as a variable.
const TARGET_PEAK: f32 = 0.89;

/// Scale a buffer so its loudest sample sits at `target`.
/// A silent buffer is left alone rather than amplified into noise.
fn normalize(samples: &mut [f32], target: f32) {
    let peak = samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    if peak <= 1e-6 {
        return;
    }
    let g = target / peak;
    for s in samples.iter_mut() {
        *s *= g;
    }
}

/// Full conversion pipeline for one clip.
pub fn prepare(clip: &Clip, target_rate: u32, target_channels: usize) -> Result<Prepared> {
    // Resample first at the source channel count — for mono clips that is half
    // the work of converting to stereo and then resampling both channels.
    let resampled = resample(&clip.samples, clip.channels, clip.rate, target_rate)?;
    let mut samples = map_channels(&resampled, clip.channels, target_channels);
    // After resampling, since interpolation can overshoot the original peak.
    normalize(&mut samples, TARGET_PEAK);
    Ok(Prepared {
        samples,
        channels: target_channels,
    })
}
