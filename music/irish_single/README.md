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

## TODO — musicality (next phase)

v1 is intentionally simple (everyone plays through, on the grid). Planned improvements:
- **Call-and-response**: instruments answer each other instead of all doubling the tune; give leads and
  fills their own bars; drop instruments in/out.
- **Stops / rests**: real phrase breaks and dynamics, not a constant wall of sound.
- **Velocity + articulation**: shaped dynamics and the Ireland keyswitch ornaments (cuts, rolls,
  slides, strikes — see the key-switch tables in `../irish_jig/README.md`), plus CC1 swells.
- **Humanize**: small timing and velocity jitter so notes aren't dead-on the grid or perfectly aligned
  across instruments.
