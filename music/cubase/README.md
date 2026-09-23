# Cubase control + MIDI writing for Claude (ClaudeBridge)

This lets Claude drive Cubase 14 from Claude Code **and write MIDI straight into the open project**,
with the instruments staying loaded. Everything rides one loopMIDI port.

```
Claude ─┬─ commands (transport, mixer, arm) ─┐
        └─ note stream ─────────────────────┤─ loopMIDI "Cubase MCP" ─→ Cubase
                                             │      ├─ ClaudeBridge MIDI Remote  ← intercepts the BOUND CCs (commands, mixer, arm)
                                             │      └─ All MIDI Inputs → record-enabled track  ← receives the UNBOUND notes + CC1
```

The trick that makes writing MIDI work: the ClaudeBridge remote **binds** the command/mixer CCs, so
Cubase routes them to the remote and they never record. Notes and CC1 are **unbound**, so they pass
through to whatever track is record-enabled. One port does both jobs.

---

## Setup that makes it work every time

Do this once; then every session and every project from the template just works.

1. **loopMIDI** running with a port named exactly **`Cubase MCP`** (set it to start with Windows).
   You do **not** need a second port — see the gotchas.
2. **Cubase → Studio → Studio Setup → MIDI Port Setup**, the `Cubase MCP` **input** row:
   - **Visible ✓, State Active**, and **In 'All MIDI Inputs' = TICKED**.
   - Ticked is correct and required: armed tracks only hear the notes through All MIDI Inputs, and
     the remote still intercepts the command CCs so they never record. *(Do not untick it — that was
     a dead end that cost us an afternoon.)*
3. **Every instrument track's input = `All MIDI Inputs`** (the default). No per-track input routing needed.
4. **ClaudeBridge connected**: Studio → MIDI Remote Manager → MIDI Controllers shows
   **ClaudeBridge / Wardogs / Claude — Connected** on input `Cubase MCP`. It auto-connects on Cubase start.
5. **Instruments loaded**, one per track, **Key Mode = Chromatic** on the melodic ones (so nothing gets
   remapped to a scale). Track order in the mixer is the index order the tools use.
6. **Save as Template** ("WARDOGS Irish"). Opening it gives loaded instruments + working bridge.
7. **Restart Claude Code** if the `cubase` MCP tools aren't listed (MCP servers load at session start).

Sanity check after opening: run `python cubase-mcp/send_command.py zoom_full` — the arrange zoom
should change. If not, the bridge isn't connected (restart Cubase).

---

## Files here (version-controlled copies)

| File | What it is |
|---|---|
| `server.patch` | Our changes to [hedidjs/cubase-mcp](https://github.com/hedidjs/cubase-mcp), against commit `caa3b17` |
| `wardogs_remote.py` | The MIDI protocol, command list, and the generator for the Cubase script |
| `wardogs_claudebridge.js` | The generated Cubase MIDI Remote script (reference copy) |
| `send_command.py` | Fire one bridge command (optionally N times): `send_command.py record` |
| `stream_notes.py` | Stream a jig part real-time to `Cubase MCP` |
| `record_single.py` | The recorder: arm a track by index → record → stream → disarm; `--all` batches every track |
| `record_midi.py` | General file-based recorder: `record_midi.py <file.mid> --all` records every named track (notes + keyswitches + CC1) into the project, arming by index |
| `apply_mix.py` | Sets volume + pan per track from a `MIX` table (session-style stereo image) |

The live working copies run from `C:\Users\pgpav\cubase-mcp` (the git clone of cubase-mcp with our
patch applied). These repo copies are the backup / source of truth.

---

## Writing MIDI into the live project (the method that works)

Per track: **arm by index → return to zero → record → stream notes real-time → stop → disarm.**

- **Arm by INDEX, never by navigation.** `record_single.py` arms a track by sending the rec-enable CC
  on that track's mixer channel (`CC 22` on channel *track−1*). This is focus-independent. The
  `Navigate Up/Down` commands only move selection when the project window has keyboard focus, so they
  are useless for automation — do not use them to pick the record track.
- **One port, notes on any channel.** The stream sends note-on/off (and CC1 for dynamics). The remote
  ignores them; the armed track records them.
- **Recording is real-time.** A pass takes as long as the part. Record engages ~0.15 s after the
  `record` command, so `record_single.py` waits before streaming the downbeat.
- **Record ADDS a part, it does not replace.** Clear the track (or the whole project) before a clean
  take, or you stack parts.

Record one instrument onto the currently-armed track:
```
python cubase-mcp/record_single.py Bouzouki
```
Record a whole song (arms/records/disarms every track itself, in Cubase mixer order):
```
python cubase-mcp/record_single.py --all          # all tracks
python cubase-mcp/record_single.py --all 2         # skip track 1 (already done)
```
`record_single.py`'s `CUBASE_ORDER` list must match the top-to-bottom track order in the project.

To hear/export the result: `send_command.py play`, or `cubase_command export_audio_mixdown` (finish
the dialog by hand) for a WAV/MP3.

---

## Protocol

| Target | MIDI channel | CC | Value |
|---|---|---|---|
| Mixer track *n* (1–16) volume | *n* − 1 | 7 | 0–127 (CC 100 = 0 dB, CC 64 = −8.17 dB) |
| Mixer track *n* pan | *n* − 1 | 10 | 0 L · 64 C · 127 R |
| Mixer track *n* mute | *n* − 1 | 20 | 127 on · 0 off |
| Mixer track *n* solo | *n* − 1 | 21 | 127 on · 0 off |
| Mixer track *n* record-enable | *n* − 1 | 22 | 127 arm · 0 disarm |
| Command *i* | 16 | 40 + *i* | 127 then 0 |
| **Note data to record** | any (0–15) | note-on/off, CC1 | — (unbound, flows to the armed track) |

Mixer track *n* counts instrument/audio/MIDI channels left-to-right; input channels (Stereo In) are
skipped, so track 1 is the first instrument track.

**43 commands:** play, stop, record, return_to_zero, goto_end, cycle, metronome, next_marker,
previous_marker, to_left_locator, locators_to_selection, nudge_cursor_left, nudge_cursor_right, save,
save_new_version, import_midi_file, export_audio_mixdown, undo, redo, select_all, select_none,
duplicate, delete, mute_selected_events, split_at_cursor, open_close_editor, deactivate_all_solo,
quantize, legato, zoom_in, zoom_out, zoom_full, zoom_to_selection, select_previous_track,
select_next_track, navigate_left, navigate_right, show_mixer, show_vst_instruments,
export_dawproject, import_dawproject, record_enable, monitor.

To add a command: append it to `COMMANDS` in `wardogs_remote.py`, rerun it (it verifies the name
against Cubase's Key Commands.xml), then **restart Cubase**.

---

## Mistakes we made — do not repeat

- **Unticking `Cubase MCP` from All MIDI Inputs.** Then no armed track ever hears the notes. It must be
  ticked; the remote already stops the command CCs from recording.
- **Selecting the record track with Navigate Up/Down.** Focus-dependent; it silently did nothing and
  kept re-arming track 1. Arm by mixer index instead (CC 22).
- **A second loopMIDI port ("Cubase Notes") for the notes.** Windows gave it a dead handle — 0
  throughput even sending by raw rtmidi index, and delete/recreate with the same name didn't fix it.
  Abandoned; one port carries both.
- **Expecting "Reload Scripts" to pick up binding changes.** It doesn't reliably. After editing
  `wardogs_remote.py`, **restart Cubase**. A brand-new script folder also needs a restart to appear.
- **`Add Surface` → `Create MIDI Controller Surface`.** Makes an empty Surface Editor device with the
  same name that fights our script. Never use it; our script self-connects.
- **DAWproject import for iterative edits.** It opens a *new* project with duplicate instrument
  instances. Great for reading a project or a big rewrite, wrong for tweaking the open one.
- **Reverse-engineering Cubase's DLLs to call internal functions.** Fragile across updates and off the
  table. The record-through-loopMIDI method needs none of it.
- **`mcp>=1.0.0` in upstream requirements** installs 2.x where `FastMCP` is gone → pin `mcp<2`.
- **The server printing to stdout** breaks the MCP stdio channel ("Connection closed") → all logs to
  stderr (in the patch).

---

## Tested on screen (2026-09-23, Cubase 14.0.32)

| Works | Checked by |
|---|---|
| mute / solo / pan / volume by index | mixer strips changed and reset |
| play / stop / return_to_zero / cycle / zoom | meters, playhead, ruler, cycle range |
| record_enable by index (CC 22) | armed track 3 by number, not the selected one |
| **record a track** | notes streamed on `Cubase MCP` recorded onto the armed track, instrument stayed loaded |
| **record all 11 (`--all`)** | the 10-second single — every instrument got its part in one batch |
| import_midi_file / export_dawproject / import_dawproject | dialog / file written / project imported |

Cubase crashed once mid-session (likely the foreground-window screenshot trick — avoid forcing window
focus); it reopened fine with project state intact.

---

## Rebuilding the server from scratch

```
git clone https://github.com/hedidjs/cubase-mcp.git && cd cubase-mcp
git checkout caa3b17
git apply <repo>/music/cubase/server.patch
copy <repo>\music\cubase\wardogs_remote.py .
copy <repo>\music\cubase\send_command.py .
copy <repo>\music\cubase\stream_notes.py .
copy <repo>\music\cubase\record_single.py .
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt "mcp<2"
.venv\Scripts\python.exe wardogs_remote.py      # writes the Cubase MIDI Remote script
claude mcp add --scope user cubase -- C:/Users/pgpav/cubase-mcp/.venv/Scripts/python.exe C:/Users/pgpav/cubase-mcp/server.py
```
Then do the **Setup** section above in Cubase, and restart Cubase once.

Also installed but not used for this: [tubone24/midi-mcp-server](https://github.com/tubone24/midi-mcp-server)
at `C:\Users\pgpav\midi-mcp-server` (MCP `midi`); its `create_midi` only returns base64, so we generate
MIDI with Python + `mido` instead.
