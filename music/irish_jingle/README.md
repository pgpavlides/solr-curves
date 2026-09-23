# Irish jingle (fast, ~10s)

`make_jingle.py` writes `jingle.mid`: a fast, punchy 10-second Irish jingle at **172 bpm, 4/4**, using
a tight 5-piece instead of the full band.

```
python make_jingle.py        # -> jingle.mid   (needs: pip install mido)
```

## The 5 pieces

| Instrument | Part |
|---|---|
| Tin Whistle + Fiddle | the hook in unison — hook (2 bars) → variation (2) → climb (2), with cuts/rolls and a rising CC1 |
| Mandolin | driving 16th-note strums (up/down keyswitches) |
| Bouzouki | eighth-note chord strums |
| Bodhran | fast reel rhythm, accents on 1 & 3, a flam on the final hit |

Ends on a **button**: whistle/fiddle land on a held D, mandolin + bouzouki hit the D chord, bodhran
flam, CC1 to full — then let ring. Chords D · D · G · A · D · A → D.

Uses the same engine ideas as `../irish_single/make_arrangement.py`: Ireland keyswitch ornaments, a
**latch-reset keyswitch on every track's first note**, humanized timing, and CC1 drive on the leads
(tremolo kept off the plucked instruments).

## Record it

Open the WARDOGS Irish template, clear the tracks, then:
```
python C:/Users/pgpav/cubase-mcp/record_midi.py <path>/jingle.mid --all
python C:/Users/pgpav/cubase-mcp/apply_mix.py
```
`record_midi.py` records only the tracks present in the file (the other six stay empty).
