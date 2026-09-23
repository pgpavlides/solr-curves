# Irish jig + the "WARDOGS Irish" template

`make_jig.py` writes `jig.mid`: an original jig in D major, 6/8, 174 bpm (116 dotted quarters),
AABB played twice plus a held ending, 1:07. There are 11 named tracks, one per instrument of
Native Instruments **Spotlight Collection: Ireland**. The parts use the library's real key maps:
keyswitch ornaments, legato overlaps and mod-wheel dynamics.

```
python make_jig.py        # needs: pip install mido
```

The script refuses to write any note outside an instrument's playable range (the `MAP` table).

## Parts

| Track | Plays | Articulation |
|---|---|---|
| Tin Whistle | tune, bars 1–65 | cuts, triplet rolls, strikes into new parts, legato, CC1 swells |
| Bouzouki | chords, bars 1–65 | jig strum down·up·down·up (eighths 1, 3, 4, 6), Upstroke keyswitch, CC1 = 0 |
| Bodhran | from bar 9 | single hits: accented down/up strokes, ghosts, top tone, flams into parts, triplet rolls at phrase ends, damp at the end |
| Fiddle | tune, from bar 17 | cuts, triplet rolls, slides into new parts, legato, CC1 swells |
| Uilleann Pipes | tune, second round (bar 33) | cuts, triplet rolls, strikes, Vibrato on the last note, legato, CC1 swells |
| Button Accordion, Concertina, Irish Flute, Irish Harp, Mandolin, Tenor Banjo | empty | ready to fill |

The keyswitch notes (MIDI 24–35) sit on the same tracks as the melody. They're meant to be there.

## The Cubase template: "WARDOGS Irish"

- **One Instrument track per instrument**, each with its own Kontakt 8 and one Ireland `.nki`. That gives every instrument its own mixer channel, and Claude's mixer track numbers match this order:

  | # | Track | # | Track |
  |---|---|---|---|
  | 1 | Bouzouki | 7 | Mandolin |
  | 2 | Button Accordion | 8 | Tenor Banjo |
  | 3 | Concertina | 9 | Tin Whistle |
  | 4 | Fiddle | 10 | Bodhran |
  | 5 | Irish Flute | 11 | Uilleann Pipes |
  | 6 | Irish Harp | | |

- **Key Mode = Chromatic** on every melodic instrument. In *Scale* mode, notes outside the preset scale get remapped (Irish presets are often Mixolydian or Dorian).
- **Uilleann Pipes:** switch the drones on in the instrument if wanted (F#6). They're left out of the MIDI because it's unclear whether that key toggles.
- **Save** it with *File → Save as Template*. The song1 project lives in `E:\WARDOGS_SOUNDBOARD\Cubase_songs\Song1\`.

### Bringing a song in

1. Drag the `.mid` into the project. Cubase adds one MIDI track per part.
2. Ctrl-drag each part (Ctrl keeps it on bar 1) onto the instrument track with the same name, then delete the imported tracks.
3. Set the tempo and signature: transport bar, or *Ctrl+T* (Tempo Track). The jig is **174 / 6/8**.

## Spotlight Collection: Ireland: what we found

Library at `D:\Ireland Library` (11 instruments, snapshots with MIDI phrases). Manual:
[PDF](https://www.native-instruments.com/fileadmin/ni_media/downloads/manuals/spotlight_collection/Ireland_Manual_English_11_12_23.pdf) ·
[online](https://www.native-instruments.com/ni-tech-manuals/ireland-manual/). The readme's
`native-instruments.com/Irelandmanual` link is dead (404).

**Octave naming:** NI tunes to A3 = 440 Hz, so **C3 = MIDI 60**, one octave lower than the usual C4 = 60. The tables below give MIDI numbers.

The manual has no per-instrument key tables. Those appear only on each instrument's
**Mapping** tab in Kontakt. The tables below were read off those tabs.

### Common to all instruments

- **CC1 (mod wheel) = Performance slider:** Dynamic on wind and bowed instruments, Tremolo on plucked ones, Fill Speed (1/16 to 1/32) on the Bodhran.
- **Keyswitches:** hold the keyswitch while playing a note in the main range to get that ornament or sound variation.
- **Legato:** Fiddle, Irish Flute, Tin Whistle and Pipes have two recorded legato sets. Overlap notes to get legato.
- **Release velocity:** a gentle key release gives a soft release; a fast one gives an abrupt release with noise.
- **Poly aftertouch:** on the Irish Flute it retriggers the held note with an ornament. On the Irish Harp it damps the note.
- **Key Mode:** *Scale* restricts notes to the scale, *Guide*/*Chromatic* plays everything, *Extended* turns out-of-scale notes into ornaments (set up in the Scale Editor), *White Keys* puts a 7-note scale on the white keys.

### Key maps (MIDI numbers)

**Bodhran**. 36–47 patterns (e.g. 43 = "Jig 5 (Back Beat)"), 48–59 fills, **60–83 single hits**:

| MIDI | Hit | MIDI | Hit | MIDI | Hit |
|---|---|---|---|---|---|
| 60 | Down | 68 | Up Soft | 76 | Flam |
| 61 | Up | 69 | Down Ghost | 77 | Triplet Tone 1 |
| 62 | Down (2nd sample) | 70 | Up Ghost | 78 | Triplet Tone 2 |
| 63 | Up (2nd sample) | 71 | Top Short | 79 | Triplet Tone 3 |
| 64 | Top | 72 | Triplet Dn | 80 | Triplet Tone 4 |
| 65 | Down Accent | 73 | Triplet Up | 81 | Rim Dn |
| 66 | Up Accent | 74 | Triplet Dn Var | 82 | Rim Up |
| 67 | Down Soft | 75 | Triplet Up Var | 83 | Damp |

Beater (Hotrod, Stick, Hand) is chosen in the instrument.

**Melodic instruments.** Keyswitches are on 24–35:

| MIDI | Tin Whistle | Fiddle | Uilleann Pipes | Bouzouki |
|---|---|---|---|---|
| 24 | Short | Short | Short | Short 1 |
| 25 | Long | Long | Vibrato | Short 2 |
| 26 | Sound Var | Sound Var | Sound Var | Sound Var |
| 27 | Slide | Slide | Slide | Upstroke |
| 28 | Strike | Crann | Strike | Reso FX |
| 29 | Cut | Cut | Cut | Pull Off |
| 30 | Triplet 1 | Triplet 1 | Triplet 1 | Triplet 1 |
| 31 | Cut Short | Mordent | Turn | Open/Stopped |
| 32 | Triplet 2 | Triplet 2 | Triplet 2 | Triplet 2 |
| 33 | Triplet 3 | Turn | Triplet 3 | Triplet 3 |
| 34 | Legato Alt | Legato Alt | Legato Alt | Damp Note |
| 35 | Lower HT | Lower HT | Lower HT | Lower HT |
| **Playing range** | **62–86** | **55–84** | **62–86** | **55–86** |
| **Performance keys** | 37 Fade, 39 Cresc, 42 Stop Note | 37 Fade, 39 Cresc, 42 Stop Note | on C6: 97 Fade, 99 Cresc, 102 Drones | 37/39/42/44 open strings IV/III/II/I, 47 Damp All |
| **Phrases** | white keys 36–45 | white keys 36–45 | white keys 96–105 | white keys 36–45 |
| **CC1** | Dynamic | Dynamic | Dynamic | Tremolo |

The Pipes also have **Regulators** on 43–59.

### The other six (read 2026-09-23)

Keyswitches on 24–35, same as above. Full per-key labels live in the `MAP` `ks=` dicts in `make_jig.py`; the useful ornaments and ranges:

| MIDI | Irish Flute | Mandolin | Tenor Banjo | Irish Harp | Concertina | Button Accordion |
|---|---|---|---|---|---|---|
| 24 | Short | Downstroke | Downstroke | Thumb | Short | Short |
| 25 | Long | Upstroke | Upstroke | Index Finger | Long | Long |
| 26 | Sound Var | Sound Var | Sound Var | Sound Var | Sound Var | Sound Var |
| 27 | Slide | Triplet 1 | Triplet 1 | Triplet 1 | Octave | Octave |
| 28 | Strike | Reso FX | Reso FX | Harmonics | Button Only | Button Only |
| 29 | Cut | Pull Off | Pull Off | Cut | Cut | Cut |
| 30 | Triplet 1 | Triplet 2 | Triplet 2 | Triplet 2 | Triplet 1 | Triplet 1 |
| 31 | Cut Short | Decaying | Open/Stopped | Open/Stopped | Slide Up | Slide Up |
| 32 | Triplet 2 | Damp Note | Damp Note | Damp Note | Triplet 2 | Triplet 2 |
| 33 | Triplet 3 | Triplet 3 | Triplet 3 | Short Gliss | Grace | Strike |
| 35 | Lower HT | Lower HT | Lower HT | Lower HT | Lower HT | Lower HT |
| **range** | 55–84 | 55–86 | 48–81 | 36–86 | 55–84 | 48–84 |
| **CC1** | Dynamic | Tremolo | Tremolo | Tremolo | Dynamic | Dynamic |

Notes: Flute keyswitches are identical to the Tin Whistle. Button Accordion also has **bass buttons on C1–B1 (36–47)** and performance keys up at C6 — keep melody in 48–84. Harp has the widest range and a Damp-All on its C6 performance keys. Ranges are read from the Mapping tabs; the generator range-check is the backstop.
