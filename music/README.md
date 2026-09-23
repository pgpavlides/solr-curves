# WARDOGS music

| Folder | What |
|---|---|
| `irish_jig/` | Irish jig as multi-track MIDI for Cubase + NI Spotlight Collection: Ireland, the key maps we found, and the "WARDOGS Irish" template |
| `cubase/` | ClaudeBridge: how Claude controls Cubase (loopMIDI + patched cubase-mcp + MIDI Remote script), and how to rebuild it |
| this folder | the three synthesised organ pieces below |

Original organ music for the videos. All three pieces are written from scratch, and the organ is
synthesised from sine waves in `organ.py`. There are no samples, loops or third-party recordings,
so nothing in the audio can match a Content ID reference.

| Track | Style | Key / metre | Length |
|---|---|---|---|
| `tracks/01_kolokola.mp3` Колокола (Bells) | slow Orthodox-style chorale, builds to full organ | D minor, 4/4, 66 bpm | 1:32 |
| `tracks/02_marsh.mp3` Марш (March) | military march, trumpet stop over oom-pah pedal | A minor, 2/4, 112 bpm | 1:20 |
| `tracks/03_step.mp3` Степь (Steppe) | melancholy waltz, flutes with tremulant, then oboe | E minor, 3/4, 126 bpm | 1:27 |

All three are mastered to about −14 LUFS with peaks at −1 dBFS, which is YouTube's loudness target.

## Files

- `songs.py`: the compositions. Each one is a melody in plain notation plus one chord per bar.
  The accompaniment (inner voices and pedal) is generated from the chords.
- `organ.py`: the synthesiser (pipe ranks, stops, tremulant, hall reverb) and the MIDI writer.
- `render.py`: writes `tracks/<slug>.wav`, `.mp3` (320k) and `.mid`.
- `tracks/*.mid`: the same music as MIDI (Church Organ, with the exact tempo map). Drop it into a DAW
  if you want a different organ or extra instruments.

The WAVs are gitignored. They are about 15 MB each, and one command rebuilds them.

## Rendering

Requires Python 3 with numpy, and ffmpeg on PATH.

```
python music/render.py            # all songs (~20 s)
python music/render.py 02_marsh   # one song
```

## Writing or editing a song

```
melody='D5:2 A4:1 D5:1 | G5:1.5 F5:0.5 D5:2 | ~:4'
chords='Dm Gm Gm'
```

- `NOTE:beats`. `r` is a rest, `~` ties onto the previous note, and `|` is a bar line. Each bar
  must add up to the metre, or the render stops and names the bad bar.
- Chords are `C`, `Cm`, `C7`, `Cm7` or `Cdim`, with `#`/`b` roots. `Dm,A` splits a bar in two.
- `accomp`: `chorale` (held chords), `march` (off-beat chords, root/fifth pedal) or `waltz`.
- `reg`: stops for the melody, harmony and pedal. See `REG` in `organ.py` (`flute8`,
  `flute_trem`, `celeste`, `principal8_4`, `plenum`, `trumpet`, `full`, `oboe`, `pedal_*`, ...).
- `dyn` scales a section's volume. `rit=True` slows the section to 70% of its tempo by the end.
