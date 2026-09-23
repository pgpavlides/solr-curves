"""Record any multi-track .mid into the open Cubase project via ClaudeBridge + loopMIDI.

Streams each track's notes/keyswitches/CC on the 'Cubase MCP' port (the remote intercepts the bound
command CCs, so only the musical data records). Arms each track by mixer index — no selection/focus.

    python record_midi.py <file.mid> <TrackName>   # onto the currently-armed track
    python record_midi.py <file.mid> --all [start]  # arm+record every track, in Cubase order
"""
import sys
import time

import mido

import wardogs_remote as remote

# Cubase project track order (top -> bottom) by track name
CUBASE_ORDER = ['Bouzouki', 'Button Accordion', 'Concertina', 'Fiddle', 'Irish Flute',
                'Irish Harp', 'Mandolin', 'Tenor Banjo', 'Tin Whistle', 'Bodhran', 'Uilleann Pipes']

_cmd = mido.open_output(next(n for n in mido.get_output_names() if n.startswith(remote.PORT_PREFIX)))


def command(name):
    cc = remote.command_cc(name)
    _cmd.send(mido.Message('control_change', channel=remote.COMMAND_CHANNEL, control=cc, value=127))
    _cmd.send(mido.Message('control_change', channel=remote.COMMAND_CHANNEL, control=cc, value=0))


def arm(index, on):
    _cmd.send(mido.Message('control_change', channel=index - 1, control=remote.CC_REC,
                           value=127 if on else 0))


def load(path):
    """{track_name: [(seconds, message_on_channel_0)]} for the musical (note/CC) events."""
    mid = mido.MidiFile(path)
    tempo = next((m.tempo for tr in mid.tracks for m in tr if m.type == 'set_tempo'), 500000)
    spt = tempo / 1e6 / mid.ticks_per_beat
    out = {}
    for tr in mid.tracks:
        t, ev = 0, []
        for msg in tr:
            t += msg.time
            if msg.type in ('note_on', 'note_off', 'control_change'):
                ev.append((t * spt, msg.copy(channel=0)))
        if ev and tr.name in CUBASE_ORDER:
            out[tr.name] = ev
    return out


def stream(events, port):
    t0 = time.perf_counter()
    for when, msg in events:
        dt = when - (time.perf_counter() - t0)
        if dt > 0:
            time.sleep(dt)
        port.send(msg)
    port.send(mido.Message('control_change', channel=0, control=123, value=0))
    return events[-1][0]


def record_track(events, port):
    command('return_to_zero')
    command('record')
    time.sleep(0.15)
    dur = stream(events, port)
    command('stop')
    return dur


def main():
    path = sys.argv[1]
    tracks = load(path)
    port = mido.open_output(next(n for n in mido.get_output_names() if n.startswith(remote.PORT_PREFIX)))
    if sys.argv[2] != '--all':
        print(f'{sys.argv[2]}: {record_track(tracks[sys.argv[2]], port):.1f}s')
        return
    start = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    for k in range(1, len(CUBASE_ORDER) + 1):
        arm(k, False)
        time.sleep(0.05)
    for k, name in enumerate(CUBASE_ORDER, 1):
        if k < start or name not in tracks:
            continue
        arm(k, True)
        time.sleep(0.25)
        dur = record_track(tracks[name], port)
        arm(k, False)
        time.sleep(0.25)
        print(f'[{k:2}/{len(CUBASE_ORDER)}] {name:17} {dur:.1f}s')


if __name__ == '__main__':
    main()
