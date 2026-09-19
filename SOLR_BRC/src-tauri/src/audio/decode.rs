//! Offline decoding of sound files into in-memory interleaved f32 clips.
//!
//! Decoding happens on a worker thread at library-load time, never in the
//! audio callback. The real-time mixer only ever reads finished `Clip`s, so
//! nothing here needs to be allocation-free.

use std::fs::File;
use std::path::Path;

use anyhow::{anyhow, Context, Result};
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

/// A decoded clip, interleaved, still at its own native sample rate.
/// Resampling to the output device rate happens later, in `resample`.
#[derive(Debug, Clone)]
pub struct Clip {
    pub samples: Vec<f32>,
    pub channels: usize,
    pub rate: u32,
}

impl Clip {
    pub fn frames(&self) -> usize {
        if self.channels == 0 {
            0
        } else {
            self.samples.len() / self.channels
        }
    }

    pub fn duration_secs(&self) -> f32 {
        if self.rate == 0 {
            0.0
        } else {
            self.frames() as f32 / self.rate as f32
        }
    }

    /// Peak absolute sample, used by the UI to draw a waveform and to warn
    /// about clips that will clip the bus.
    pub fn peak(&self) -> f32 {
        self.samples.iter().fold(0.0f32, |m, s| m.max(s.abs()))
    }
}

/// Decode any container/codec symphonia supports into interleaved f32.
pub fn decode_file(path: &Path) -> Result<Clip> {
    let file = File::open(path).with_context(|| format!("open {}", path.display()))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // The extension is only a hint; symphonia still sniffs the actual bytes,
    // so a mislabelled .wav that is really an mp3 still decodes.
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let mut reader = symphonia::default::get_probe()
        .probe(
            &hint,
            mss,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .with_context(|| format!("unrecognised audio container: {}", path.display()))?;

    // Pull the track id and codec params out, then drop the borrow so we can
    // iterate packets mutably below.
    let (track_id, params) = {
        let track = reader
            .default_track(TrackType::Audio)
            .or_else(|| reader.first_track_known_codec(TrackType::Audio))
            .ok_or_else(|| anyhow!("no audio track in {}", path.display()))?;
        let params = track
            .codec_params
            .as_ref()
            .and_then(|p| p.audio())
            .ok_or_else(|| anyhow!("undecodable codec params in {}", path.display()))?
            .clone();
        (track.id, params)
    };

    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(&params, &AudioDecoderOptions::default())
        .with_context(|| format!("unsupported codec in {}", path.display()))?;

    let mut samples: Vec<f32> = Vec::new();
    let mut scratch: Vec<f32> = Vec::new();
    let mut rate = 0u32;
    let mut channels = 0usize;

    while let Some(packet) = reader.next_packet()? {
        if packet.track_id != track_id {
            continue;
        }
        match decoder.decode(&packet) {
            Ok(buf) => {
                let spec = buf.spec();
                rate = spec.rate();
                channels = spec.channels().count();
                scratch.clear();
                buf.copy_to_vec_interleaved(&mut scratch);
                samples.extend_from_slice(&scratch);
            }
            // A single corrupt frame mid-file should not lose the whole clip.
            Err(SymError::DecodeError(_)) => continue,
            Err(e) => return Err(e).context(format!("decoding {}", path.display())),
        }
    }

    if samples.is_empty() || channels == 0 || rate == 0 {
        return Err(anyhow!("decoded no audio from {}", path.display()));
    }

    Ok(Clip {
        samples,
        channels,
        rate,
    })
}
