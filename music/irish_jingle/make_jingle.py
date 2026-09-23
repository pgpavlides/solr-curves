"""A fast ~10s Irish jingle: a tight 5-piece at 172 bpm, building to a button ending.

Tin Whistle + Fiddle carry the hook in unison, Mandolin drives 16th-note strums, Bouzouki lays down
the chords, the Bodhran pushes it along. Uses the Ireland key maps: keyswitch ornaments + the
latch-reset on the first note, humanized timing, and a rising CC1 into the final hit.

    python make_jingle.py        # -> jingle.mid   (needs: pip install mido)
"""
import math
import pathlib
import random
import sys

import mido

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'irish_jig'))
from make_jig import note_number, MAP  # noqa: E402

TPQ = 480
E = TPQ // 2            # eighth
SIX = TPQ // 4          # sixteenth
BAR = 8 * E            # 4/4
BPM = 172

# hook (2 bars) -> variation (2) -> climb (2) -> button (bar 6). D major, <= B5 so the fiddle can play it.
HOOK = ['D5 F#5 A5 F#5 D5 F#5 A5 B5', 'A5 F#5 D5 E5 F#5 E5 D5 D5']
VAR = ['D5 F#5 A5 F#5 B5 A5 F#5 A5', 'G5 F#5 E5 D5 E5 F#5 A5 B5']
CLIMB = ['A5 B5 A5 F#5 A5 B5 A5 F#5', 'D5 E5 F#5 A5 B5 A5 F#5 E5']
MELODY = HOOK + VAR + CLIMB                 # bars 0-5
CHORDS = ['D', 'D', 'G', 'A', 'D', 'A']     # bars 0-5; bar 6 = button on D
TRIAD = {'D': [57, 62, 66, 69], 'G': [55, 59, 62, 67], 'A': [57, 61, 64, 69]}
BUTTON = 6 * BAR
DEFAULT_KS = {'Tin Whistle': 25, 'Fiddle': 25, 'Mandolin': 24, 'Bouzouki': 24}

# name, channel — only the instruments this jingle uses (record_midi records just these)
TRACKS = [('Bouzouki', 0), ('Fiddle', 3), ('Mandolin', 6), ('Tin Whistle', 8), ('Bodhran', 9)]


def parse(bars):
    out, t = [], 0
    for bar in bars:
        for tok in bar.split():
            name, _, n = tok.partition(':')
            length = int(n or 1) * E
            out.append((t, length, note_number(name)))
            t += length
    return out


def lilt(pos):
    return 1.0 if pos in (0, 2, 4, 6) else 0.85     # driving, even push


def lead(instr, dyn, rng):
    m = MAP.get(instr, {})
    notes = parse(MELODY)
    out = []
    for i, (t, length, p) in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        dur = length + 16 if (nxt and nxt[2] != p) else int(length * 0.9)
        pos = (t % BAR) // E
        out.append((t, dur, p, int(102 * dyn * lilt(pos))))
        ks = m.get('roll') if length >= 2 * E else (m.get('cut') if pos in (0, 4) and rng.random() < 0.45 else None)
        if ks:
            out.append((max(0, t - 20), length, ks, 100))
    out.append((BUTTON, BAR, note_number('D5'), int(118 * dyn)))          # the button note
    # guarantee a keyswitch on the very first note (reset the latch)
    if not any(e[2] < 36 and e[0] <= 20 for e in out):
        out.append((0, E, DEFAULT_KS[instr], 96))
    return out


def strum(instr, step, dyn, rng):
    m = MAP.get(instr, {})
    out = []
    for b, sym in enumerate(CHORDS):
        t0 = b * BAR
        for e in range(BAR // step):
            down = e % 2 == 0
            voic = TRIAD[sym]
            vel = int((96 if (e * step) % (2 * E) == 0 else 72) * dyn)
            for k, p in enumerate(voic if down else voic[::-1]):
                out.append((t0 + e * step + 4 * k, int(step * 0.85), p, max(1, vel - 5 * k)))
            if 'downstroke' in m:
                out.append((t0 + e * step - 14, step, m['downstroke'] if down else m['upstroke'], 100))
    for k, p in enumerate(TRIAD['D']):                                    # button chord (accent, let ring)
        out.append((BUTTON + 4 * k, BAR, p, int(112 * dyn) - 4 * k))
        if 'downstroke' in m:
            out.append((BUTTON - 16, E, m['downstroke'], 100))
    if 'downstroke' not in m and instr in DEFAULT_KS:                     # reset latch for plain strummers
        out.append((0, E, DEFAULT_KS[instr], 96))
    return out


def drum(dyn, rng):
    dn, up, dacc, uacc, ghost, flam = 60, 61, 65, 66, 69, 76
    out = []
    for b in range(6):
        t0 = b * BAR
        for e in range(8):
            acc = e in (0, 4)
            key = dacc if e == 0 else uacc if e == 4 else (dn if e % 2 == 0 else up)
            if e in (3, 7) and rng.random() < 0.35:
                key = ghost
            out.append((t0 + e * E, E // 2, key, int((114 if acc else 74) * dyn)))
    out.append((BUTTON, E, flam, 120))                                    # final hit
    return out


def hum(rng, notes, sd):
    out = []
    for t, length, p, v in notes:
        if p < 36:
            out.append((t, length, p, v))
            continue
        out.append((max(0, t + int(rng.gauss(0, sd))), int(length * rng.uniform(0.92, 1.0)), p,
                    int(max(1, min(127, v + rng.gauss(0, 5))))))
    return out


def cc1_for(instr):
    """Rising drive into the button, with a light phrase swell (wind/bowed only)."""
    if instr not in ('Tin Whistle', 'Fiddle'):
        return []
    out = []
    end = BUTTON + BAR
    t = 0
    while t < end:
        base = 0.6 + 0.4 * (t / end)                                      # steady build to full
        swell = 0.1 * math.sin(2 * math.pi * (t % (2 * BAR)) / (2 * BAR) - math.pi / 2)
        if t >= BUTTON:
            base, swell = 1.0, 0
        out.append((t, int(max(0, min(127, 12 + 115 * (base + swell))))))
        t += 80
    return out


def build():
    rng = random.Random(7)
    data = {}
    for instr, ch in TRACKS:
        if instr in ('Tin Whistle', 'Fiddle'):
            notes = lead(instr, 1.0, random.Random(hash(instr) & 0xffff))
        elif instr == 'Mandolin':
            notes = strum(instr, SIX, 0.9, rng)
        elif instr == 'Bouzouki':
            notes = strum(instr, E, 0.95, rng)
        else:
            notes = drum(1.0, rng)
        notes = hum(random.Random(hash(instr) & 0xffff), notes, 6)
        lo, hi = MAP[instr]['range']
        bad = sorted({p for _, _, p, _ in notes if p >= 36 and not lo <= p <= hi})
        if bad:
            raise SystemExit(f'{instr}: notes {bad} outside range {lo}-{hi}')
        data[instr] = (ch, notes, cc1_for(instr))
    return data


def write(path):
    mid = mido.MidiFile(type=1, ticks_per_beat=TPQ)
    mid.tracks.append(mido.MidiTrack([
        mido.MetaMessage('track_name', name='Wardogs Irish Jingle', time=0),
        mido.MetaMessage('time_signature', numerator=4, denominator=4, time=0),
        mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0)]))
    for instr, (ch, notes, cc) in build().items():
        ev = [(t, 0, mido.Message('control_change', channel=ch, control=1, value=v)) for t, v in cc]
        for t, length, p, v in notes:
            ev.append((t + length, 1, mido.Message('note_off', channel=ch, note=p)))
            ev.append((t, 2, mido.Message('note_on', channel=ch, note=p, velocity=v)))
        ev.sort(key=lambda e: (e[0], e[1]))
        track = mido.MidiTrack([mido.MetaMessage('track_name', name=instr, time=0)])
        last = 0
        for tick, _, msg in ev:
            tick = max(0, tick)                       # keyswitches placed before bar 1 clamp to 0
            track.append(msg.copy(time=tick - last))
            last = tick
        mid.tracks.append(track)
    mid.save(path)
    return mid


if __name__ == '__main__':
    out = pathlib.Path(__file__).with_name('jingle.mid')
    m = write(out)
    print(out, f'{m.length:.1f}s')
