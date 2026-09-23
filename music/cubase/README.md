# Cubase control for Claude (ClaudeBridge)

With this setup Claude can drive Cubase 14 from Claude Code: transport, mixer, and 39 key
commands. Messages go Claude → MCP server → loopMIDI → a Cubase MIDI Remote script.

```
Claude Code ──MCP──> cubase-mcp (server.py) ──MIDI CC──> loopMIDI "Cubase MCP" ──> MIDI Remote "Wardogs ClaudeBridge" ──> Cubase
```

## Files here

| File | What it is |
|---|---|
| `server.patch` | Our changes to [hedidjs/cubase-mcp](https://github.com/hedidjs/cubase-mcp), made against commit `caa3b17` |
| `wardogs_remote.py` | The MIDI protocol and command list. Put it next to `server.py`; run it to (re)generate the Cubase script |
| `wardogs_claudebridge.js` | The generated Cubase MIDI Remote script, kept for reference |

## What the patch fixes in upstream cubase-mcp

- **Crash at startup.** The server printed a banner to stdout, which is the MCP channel, so Claude Code reported "Connection closed". All printing now goes to stderr.
- **Port on Windows.** The server tried to create a virtual MIDI port, which Windows can't do. It now opens the loopMIDI port whose name starts with `Cubase MCP`.
- **Mixer tools.** They covered 8 tracks, and the mute/solo CC numbers collided above track 9. Now 16 tracks, with mute/solo on each track's own channel.
- **New tool.** `cubase_command(name)` runs any command in the list below.
- **Dependency.** Upstream's `requirements.txt` accepts `mcp>=1.0.0`, which now installs 2.x, where `FastMCP` no longer exists. Install `mcp<2`.

## Rebuilding from scratch

1. **loopMIDI:** `winget install --id TobiasErichsen.loopMIDI -e` (1.0.16.27 at the time). Open it, add a port named **`Cubase MCP`**, and let it start with Windows.
2. **The server** (we keep it in `C:\Users\pgpav\cubase-mcp`):
   ```
   git clone https://github.com/hedidjs/cubase-mcp.git && cd cubase-mcp
   git checkout caa3b17
   git apply <repo>/music/cubase/server.patch
   copy <repo>\music\cubase\wardogs_remote.py .
   python -m venv .venv
   .venv\Scripts\python.exe -m pip install -r requirements.txt "mcp<2"
   .venv\Scripts\python.exe wardogs_remote.py
   claude mcp add --scope user cubase -- C:/Users/pgpav/cubase-mcp/.venv/Scripts/python.exe C:/Users/pgpav/cubase-mcp/server.py
   ```
   `wardogs_remote.py` checks every command name against Cubase's own `%APPDATA%\Steinberg\Cubase 14_64\Key Commands.xml` before writing the script, and refuses to write it if any name is missing. It writes the script to `Documents\Steinberg\Cubase\MIDI Remote\Driver Scripts\Local\wardogs\claudebridge\wardogs_claudebridge.js`.
3. **Cubase:**
   - **Studio → Studio Setup → MIDI Port Setup**: on the **Cubase MCP** *input* row, untick **In 'All MIDI Inputs'**. Otherwise Claude's control messages get recorded onto tracks.
   - **Restart Cubase** after installing the script. *Reload Scripts* in the MIDI Remote Manager did not pick up the new `Local` folder while Cubase was running.
   - After the restart, **Studio → MIDI Remote Manager** lists **ClaudeBridge / Wardogs / Claude** as *Connected* on input *Cubase MCP*. It connects by itself.
   - **Don't** use the **+** / *Add Surface* → *Create MIDI Controller Surface* for this. That creates an empty Surface Editor device, not our script.
4. Restart Claude Code, because MCP servers only load when a session starts.

Also installed, but not needed for Cubase: [tubone24/midi-mcp-server](https://github.com/tubone24/midi-mcp-server) at `C:\Users\pgpav\midi-mcp-server` (registered as `midi`). Its `create_midi` tool returns the MIDI as base64 and never writes a file, so the songs here are generated with Python + `mido` instead.

## Protocol

| Target | MIDI channel | CC | Value |
|---|---|---|---|
| Mixer track *n* (1–16) volume | *n* − 1 | 7 | 0–127 |
| Mixer track *n* pan | *n* − 1 | 10 | 0 L · 64 C · 127 R |
| Mixer track *n* mute | *n* − 1 | 20 | 127 on · 0 off |
| Mixer track *n* solo | *n* − 1 | 21 | 127 on · 0 off |
| Command *i* | 16 | 40 + *i* | 127 press, then 0 |

Mixer track numbers count the Cubase mixer's audio, instrument, sampler and MIDI channels from left to right. Input channels (Stereo In) are skipped, so track 1 is the first instrument track.

**Volume scale:** CC 100 = **0.00 dB** (unity); CC 64 = −8.17 dB.

**Commands:** play, stop, record, return_to_zero, goto_end, cycle, metronome, next_marker, previous_marker, to_left_locator, locators_to_selection, nudge_cursor_left, nudge_cursor_right, save, save_new_version, import_midi_file, export_audio_mixdown, undo, redo, select_all, select_none, duplicate, delete, mute_selected_events, split_at_cursor, open_close_editor, deactivate_all_solo, quantize, legato, zoom_in, zoom_out, zoom_full, zoom_to_selection, select_previous_track, select_next_track, navigate_left, navigate_right, show_mixer, show_vst_instruments.

To add a command, append it to `COMMANDS` in `wardogs_remote.py`, rerun the script, and restart Cubase.

## Limits

- **Dialogs:** anything that opens one (import MIDI, export mixdown) only gets as far as opening it. Someone has to finish the dialog.
- **Plugins:** Claude can't load plugins or presets, or move parts between tracks.
- **`show_mixer`:** no visible effect while the MixConsole is already open in its own window.

## Tested (2026-09-23, Cubase 14, checked on screen)

| Works | How it was checked |
|---|---|
| mute / unmute | track 1 M lit, then cleared |
| solo / unsolo | track 11 S lit, other tracks solo-muted, then cleared |
| pan | track 2 to L, then back to C |
| volume | track 2 to −8.17 dB (CC 64), then 0.00 dB (CC 100) |
| play, stop, return_to_zero | level meters and playhead |
| cycle | button and locator range turned purple, then grey |
| zoom_in / zoom_out | ruler went 1-5-9-13 → 1-9-17-25 and back |
| select_next_track / select_previous_track | MixConsole selection moved and came back |
| import_midi_file | the import dialog opened |

Not tested, because they change the project or start recording: record, save, undo/redo, delete, duplicate, split, quantize, legato, select all/none, export. They use the same command-binding path as the ones that work. Not checked on screen: goto_end, markers, locators, nudge, metronome.
