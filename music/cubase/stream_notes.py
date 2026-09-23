"""Stream notes from a jig part out of the loopMIDI 'Cubase MCP' port in real time.

Cubase records them onto whichever track is record-enabled and listening to that port. Command
CCs (channel 16) are consumed by the ClaudeBridge MIDI Remote surface, so they never reach the
track; notes and CC1 on channels 1-11 are not bound, so they record.

    .venv\\Scripts\\python.exe stream_notes.py Bouzouki [max_bars]

Run make_jig's part builder to get the notes, so this always matches jig.mid.
"""
import sys
import time

import mido

sys.path.insert(0, r'C:\Users\pgpav\wardogspilot\music\irish_jig')
import make_jig as jig  # noqa: E402

# Notes ride the same "Cubase MCP" port as commands. The ClaudeBridge remote intercepts only the
# CCs it binds (commands), so unbound note + CC1 messages pass through to a record-enabled track
# whose input includes this port.
NOTE_PORT = 'Cubase MCP'
SEC_PER_TICK = 60 / (jig.BPM * jig.TPQ)


def track_channel(name):
    return next(ch for n, ch, span in jig.TRACKS if n == name)


def events_for(name, max_bars):
    ch = track_channel(name)
    span = next(span for n, ch2, span in jig.TRACKS if n == name)
    notes = jig.part_notes(name, span)
    t0 = span[0] * jig.BAR
    ev = []  # (seconds, mido.Message)
    for _, start, length, pitch, vel in notes:
        rel = start - t0
        if max_bars and rel >= max_bars * jig.BAR:
            continue
        ev.append((rel * SEC_PER_TICK, mido.Message('note_on', channel=ch, note=pitch, velocity=vel)))
        ev.append(((rel + length) * SEC_PER_TICK,
                   mido.Message('note_off', channel=ch, note=pitch)))
    ev.sort(key=lambda e: e[0])
    return ev


def main(name, max_bars):
    ev = events_for(name, max_bars)
    port_name = next(n for n in mido.get_output_names() if n.startswith(NOTE_PORT))
    print(f'{name}: {len(ev)} events, {ev[-1][0]:.1f}s, port {port_name}')
    with mido.open_output(port_name) as port:
        t_start = time.perf_counter()
        for when, msg in ev:
            dt = when - (time.perf_counter() - t_start)
            if dt > 0:
                time.sleep(dt)
            port.send(msg)
        port.send(mido.Message('control_change', channel=track_channel(name), control=123, value=0))
    print('done')


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 0)
