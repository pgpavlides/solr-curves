# Irish single (all 11 instruments)

`make_single.py` writes `single.mid`: a 10-second D-major reel, 120 bpm 4/4, 5 bars (a 4-bar phrase
plus a held tag). Every one of the 11 Spotlight Collection: Ireland instruments plays. Built for the
"WARDOGS Irish" Cubase template.

```
python make_single.py        # -> single.mid  (needs: pip install mido)
```

The generator range-checks every note against each instrument's playable range (the mapped ones from
`../irish_jig/make_jig.py`, `48-84` for the six unmapped instruments) and refuses to write out-of-range notes.

## Arrangement (v1)

| Instrument | Part |
|---|---|
| Tin Whistle, Fiddle, Uilleann Pipes | the reel melody (D5–B5), unison, legato overlaps |
| Irish Flute, Tenor Banjo | melody an octave down |
| Bouzouki, Mandolin | eighth-note chord strums |
| Button Accordion | sustained chords |
| Concertina | off-beat "chop" chords (beats 2 & 4) |
| Irish Harp | rolling arpeggios |
| Bodhran | reel rhythm, single hits, accents on 1 & 3 |

Chords: D · G · A · D, held D tag. Key Mode = Chromatic on every instrument.

## Recording it into Cubase

Reproduced live on 2026-09-23 with the ClaudeBridge record method (see `../cubase/README.md`):
open the template (all instruments loaded, all track inputs = All MIDI Inputs, `Cubase MCP` ticked in
All MIDI Inputs), clear the tracks, then:

```
python C:/Users/pgpav/cubase-mcp/record_single.py --all   # arms + records each track by index, ~2 min
```

Every track received its part, played by the loaded Ireland instruments — no reimport, instruments stayed put.

## v2 — the arrangement (`make_arrangement.py` → `arrangement.mid`, ~30s)

The reworked piece addresses the flat v1:
- **Call-and-response**: the melody is handed off — Tin Whistle (bars 2–3) → Fiddle answers (4–5) →
  Flute + Tenor Banjo (6–7) → Mandolin (8–9) → full unison finale (10–13). Instruments rest and re-enter.
- **Stops / dynamics**: a full-band stop before the finale; section dynamics from soft intro to loud finish.
- **Velocity + articulation**: shaped velocity with accents; Ireland keyswitch ornaments (cuts, rolls,
  strikes, strum direction) on the leads and strummers; CC1 swells on wind/bowed.
- **Humanize**: independent per-instrument timing + velocity jitter (keyswitches stay locked to their notes).
- **Articulation latch reset**: these instruments latch the last keyswitch, so **every entry's first note
  presses a known "normal" keyswitch** (`DEFAULT_KS`) — otherwise a note with no articulation plays whatever
  ornament was left on from a previous session. See `ensure_first_ks()`.

Record it: `python C:/Users/pgpav/cubase-mcp/record_midi.py <path>/arrangement.mid --all`, then
`python C:/Users/pgpav/cubase-mcp/apply_mix.py` for the stereo balance.
