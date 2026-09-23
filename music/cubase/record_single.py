"""Record the 10s single into Cubase, one track per pass, via the ClaudeBridge + loopMIDI method.

Notes stream on the 'Cubase MCP' port (unbound -> reach the armed track); commands (return-to-zero,
record, stop, arm, navigate) are ClaudeBridge CCs the remote intercepts.

    python record_single.py Bouzouki          # record one instrument onto the SELECTED armed track
    python record_single.py --all             # loop all 11 in Cubase track order (arms each itself)
"""
import sys
import time

import mido

sys.path.insert(0, r'C:\Users\pgpav\wardogspilot\music\irish_single')
import make_single as sng  # noqa: E402
import wardogs_remote as remote  # noqa: E402

SEC_PER_TICK = 60 / (sng.BPM * sng.TPQ)
NOTE_PORT = 'Cubase MCP'
# Cubase track order (top -> bottom), by instrument name
CUBASE_ORDER = ['Bouzouki', 'Button Accordion', 'Concertina', 'Fiddle', 'Irish Flute',
                'Irish Harp', 'Mandolin', 'Tenor Banjo', 'Tin Whistle', 'Bodhran', 'Uilleann Pipes']

_cmd_port = mido.open_output(next(n for n in mido.get_output_names() if n.startswith(remote.PORT_PREFIX)))


def command(name, count=1):
    cc = remote.command_cc(name)
    for _ in range(count):
        _cmd_port.send(mido.Message('control_change', channel=remote.COMMAND_CHANNEL, control=cc, value=127))
        _cmd_port.send(mido.Message('control_change', channel=remote.COMMAND_CHANNEL, control=cc, value=0))
        if count > 1:
            time.sleep(0.06)


def arm(track_index, on):
    """Arm/disarm a track by its 1-based mixer position (focus-independent, via the bound rec-enable CC)."""
    _cmd_port.send(mido.Message('control_change', channel=track_index - 1, control=remote.CC_REC,
                                value=127 if on else 0))


def notes_for(name):
    role = next(r for n, ch, r in sng.TRACKS if n == name)
    return sng.BUILDERS[role]()


def events_for(name):
    ev = []
    for start, length, pitch, vel in notes_for(name):
        ev.append((start * SEC_PER_TICK, mido.Message('note_on', channel=0, note=pitch, velocity=vel)))
        ev.append(((start + length) * SEC_PER_TICK, mido.Message('note_off', channel=0, note=pitch)))
    ev.sort(key=lambda e: e[0])
    return ev


def stream(name, port):
    ev = events_for(name)
    t0 = time.perf_counter()
    for when, msg in ev:
        dt = when - (time.perf_counter() - t0)
        if dt > 0:
            time.sleep(dt)
        port.send(msg)
    port.send(mido.Message('control_change', channel=0, control=123, value=0))  # all notes off
    return ev[-1][0]


def record_one(name, note_port):
    command('return_to_zero')
    command('record')
    time.sleep(0.15)  # let record engage before the downbeat
    dur = stream(name, note_port)
    command('stop')
    return dur


def main():
    note_port = mido.open_output(next(n for n in mido.get_output_names() if n.startswith(NOTE_PORT)))
    if sys.argv[1] != '--all':
        name = sys.argv[1]
        print(f'recording {name}: {record_one(name, note_port):.1f}s')
        return
    # --all [start]: arm each track by mixer index (no selection/navigation), record, disarm.
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    for k in range(1, len(CUBASE_ORDER) + 1):   # disarm everything first for a clean slate
        arm(k, False)
        time.sleep(0.05)
    for k, name in enumerate(CUBASE_ORDER, 1):
        if k < start:
            continue                          # already recorded
        arm(k, True)
        time.sleep(0.25)
        dur = record_one(name, note_port)
        arm(k, False)
        time.sleep(0.25)
        print(f'[{k:2}/11] {name:17} {dur:.1f}s')


if __name__ == '__main__':
    main()
