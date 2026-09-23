"""An original Irish jig in D major (6/8, AABB played twice) as an 11-track MIDI file for Cubase.

Every instrument gets its own named track and MIDI channel. Tracks without notes still
carry a volume message so Cubase creates them on import, ready for a VST instrument.

    pip install mido
    python make_jig.py      -> jig.mid
"""
import math
import pathlib

import mido

TPQ = 480
EIGHTH = TPQ // 2
BAR = 6 * EIGHTH
BPM = 116 * 1.5  # 116 dotted quarters per minute, written as quarter-note bpm

_LETTER = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def note_number(name):
    i, acc = 1, 0
    while i < len(name) and name[i] in '#b':
        acc += 1 if name[i] == '#' else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + _LETTER[name[0]] + acc


# (chord, melody). Tokens are NOTE or NOTE:eighths; each bar is 6 eighths.
A_PART = [
    ('D', 'A4 F#4 A4 D5 A4 F#4'),
    ('G', 'G4 B4 D5 G5:2 F#5'),
    ('D', 'F#5 E5 D5 A4:2 F#4'),
    ('A', 'E4 F#4 G4 A4:2 B4'),
    ('D', 'A4 F#4 A4 D5 E5 F#5'),
    ('G', 'G5 F#5 E5 D5 B4 G4'),
    ('A', 'A4 B4 C#5 E5 D5 C#5'),
    ('D', 'D5:2 A4 D5:3'),
]
B_PART = [
    ('D', 'D5:2 E5 F#5:2 G5'),
    ('D', 'A5:2 F#5 D5:2 F#5'),
    ('G', 'B5:2 G5 D5:2 G5'),
    ('A', 'A5 G5 F#5 E5:2 C#5'),
    ('D', 'D5:2 E5 F#5:2 G5'),
    ('Bm', 'A5 B5 A5 F#5:2 D5'),
    ('Em,A', 'G5 F#5 E5 A5 G5 E5'),
    ('D', 'F#5 E5 C#5 D5:3'),
]
ROUND = A_PART + A_PART + B_PART + B_PART
TUNE = ROUND + ROUND + [('D', 'D5:6')]  # 65 bars, last one held

# Bouzouki voicings, kept inside its playable range (MIDI 55-86)
VOICING = {'D': [57, 62, 66, 69], 'G': [55, 59, 62, 67], 'A': [57, 61, 64, 69],
           'Bm': [59, 62, 66, 71], 'Em': [55, 59, 64, 67]}

# Spotlight Collection: Ireland key maps, read off each instrument's Mapping page
# (NI naming has C3 = MIDI 60). Keyswitches C0-B0 (MIDI 24-35) are held while the note plays.
# C1-B1 hold performance and phrase keys (pipes: C6-B6), so parts never touch them.
MAP = {
    'Tin Whistle': dict(range=(62, 86), cut=29, roll=30, start=28),      # start = Strike
    'Fiddle': dict(range=(55, 84), cut=29, roll=30, start=27),           # start = Slide
    'Uilleann Pipes': dict(range=(62, 86), cut=29, roll=30, start=28, final=25),  # Vibrato
    'Bouzouki': dict(range=(55, 86), upstroke=27),
    'Bodhran': dict(range=(60, 83)),  # single hits only; 36-59 are patterns and fills
}

# name, channel (0-based; 9 = GM drum channel 10), first and last bar with notes (None = empty)
TRACKS = [
    ('Bodhran', 9, (8, 65)),
    ('Bouzouki', 0, (0, 65)),
    ('Button Accordion', 1, None),
    ('Concertina', 2, None),
    ('Fiddle', 3, (16, 65)),
    ('Irish Flute', 4, None),
    ('Irish Harp', 5, None),
    ('Mandolin', 6, None),
    ('Tenor Banjo', 7, None),
    ('Tin Whistle', 8, (0, 65)),
    ('Uilleann Pipes', 10, (32, 65)),
]
def tune_notes():
    """The melody as (bar, start tick, length ticks, pitch)."""
    out = []
    for bar, (_, line) in enumerate(TUNE):
        t = bar * BAR
        for tok in line.split():
            name, _, n = tok.partition(':')
            length = int(n or 1) * EIGHTH
            out.append((bar, t, length, note_number(name)))
            t += length
    return out


def lilt(bar, start):
    """Jig lilt: lean on beats 1 and 4."""
    return 100 if (start - bar * BAR) // EIGHTH in (0, 3) else 80


def melody_notes():
    return [(bar, t, int(length * 0.9), p, lilt(bar, t)) for bar, t, length, p in tune_notes()]


def ornamented_melody(name):
    """Legato melody with keyswitch ornaments. Key Mode must be Chromatic on the instrument."""
    m = MAP[name]
    notes = tune_notes()
    last_bar = len(TUNE) - 1
    out = []
    for i, (bar, t, length, p) in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        legato = nxt is not None and nxt[3] != p  # overlap triggers the legato samples
        dur = length + 20 if legato else int(length * 0.9)
        out.append((bar, t, dur, p, lilt(bar, t)))

        pos = (t - bar * BAR) // EIGHTH
        if bar == last_bar:
            ks = m.get('final')
        elif length == 3 * EIGHTH:
            ks = m['roll']  # triplet roll on the long notes
        elif length == 2 * EIGHTH and pos in (0, 3):
            ks = m['cut']
        elif bar % 8 == 0 and pos == 0:
            ks = m['start']  # into each new part
        else:
            ks = None
        if ks is None:
            continue
        # hold the keyswitch from just before this note until just before the next one starts,
        # so it never leaks onto the (overlapping, legato) following note
        ks_start = max(0, t - 8)
        ks_end = t + (dur if bar == last_bar else length - 12)
        out.append((bar, ks_start, ks_end - ks_start, ks, 100))
    return out


def phrase_swell(span):
    """CC1 (Performance slider = Dynamic): swell through each 8-bar phrase, fade at the end."""
    out = []
    for bar in range(span[0], span[1]):
        value = 70 + int(30 * math.sin(math.pi * ((bar % 8) + 0.5) / 8))
        if bar == len(TUNE) - 1:
            value = 60
        out.append((bar * BAR, value))
    return out


def bouzouki_notes():
    """Jig strum on eighths 1, 3, 4, 6: down . up down . up, upstrokes via keyswitch."""
    ks = MAP['Bouzouki']['upstroke']
    last_bar = len(TUNE) - 1
    out = []
    for bar, (chord, _) in enumerate(TUNE):
        halves = chord.split(',')
        t0 = bar * BAR
        # (eighth position, length in eighths, velocity, upstroke)
        strums = [(0, 6, 100, False)] if bar == last_bar else [
            (0, 2, 96, False), (2, 1, 70, True), (3, 2, 88, False), (5, 1, 68, True)]
        for pos, n, vel, up in strums:
            sym = halves[1] if len(halves) > 1 and pos >= 3 else halves[0]
            start, length = t0 + pos * EIGHTH, n * EIGHTH
            strings = VOICING[sym][::-1] if up else VOICING[sym]  # upstroke hits high strings first
            for k, p in enumerate(strings):
                out.append((bar, start + 10 * k, int(length * 0.9) - 10 * k, p, vel - 4 * k))
            if up:
                out.append((bar, start - 8, length - 4, ks, 100))
    return out


# Spotlight Collection: Ireland - Bodhran single hits (C3-B4 in NI naming, C3 = MIDI 60).
# C1-B1 trigger patterns and C2-B2 fills, so the part stays out of 36-59.
HIT = {'down': (60, 62), 'up': (61, 63), 'top': 64, 'down_acc': 65, 'up_acc': 66,
       'down_ghost': 69, 'up_ghost': 70, 'triplet_dn': 72, 'flam': 76, 'damp': 83}


def bodhran_notes():
    """Jig strokes: alternating down/up eighths, accents on 1 and 4 (D U D U D U)."""
    out = []
    last = len(TUNE) - 1
    for bar in range(len(TUNE)):
        t0 = bar * BAR
        if bar == last:
            out.append((bar, t0, EIGHTH, HIT['down_acc'], 118))
            out.append((bar, t0 + 3 * EIGHTH, EIGHTH, HIT['damp'], 100))
            continue
        alt = bar % 2  # swap between the two recorded down/up samples
        strokes = [(HIT['down_acc'], 112), (HIT['up'][alt], 72), (HIT['down'][alt], 84),
                   (HIT['up_acc'], 104), (HIT['down'][1 - alt], 76), (HIT['up'][1 - alt], 70)]
        if bar % 2:  # lighter second half on alternate bars
            strokes[4] = (HIT['down_ghost'], 64)
            strokes[5] = (HIT['up_ghost'], 60)
        if bar % 4 == 2:  # pressed-skin tone colour
            strokes[2] = (HIT['top'], 88)
        if bar % 8 == 0 and bar > 0:  # flam into each new 8-bar part
            strokes[0] = (HIT['flam'], 115)
        if bar % 8 == 7:  # triplet roll to close each phrase
            strokes[3] = (HIT['triplet_dn'], 100)
        for pos, (key, vel) in enumerate(strokes):
            out.append((bar, t0 + pos * EIGHTH, EIGHTH // 2, key, vel))
    return out


def part_notes(name, span):
    """(bar, start tick, length ticks, pitch, velocity) for one track, range-checked."""
    if span is None:
        return []
    if name == 'Bouzouki':
        notes = bouzouki_notes()
    elif name == 'Bodhran':
        notes = bodhran_notes()
    elif 'roll' in MAP.get(name, {}):
        notes = ornamented_melody(name)
    else:
        notes = melody_notes()
    notes = [n for n in notes if span[0] <= n[0] < span[1]]
    if name in MAP:  # refuse to write notes the instrument cannot play
        lo, hi = MAP[name]['range']
        bad = sorted({n[3] for n in notes if n[3] >= 36 and not lo <= n[3] <= hi})
        if bad:
            raise SystemExit(f'{name}: notes {bad} outside playable range {lo}-{hi}')
    return notes


def build():
    mid = mido.MidiFile(type=1, ticks_per_beat=TPQ)
    meta = mido.MidiTrack([
        mido.MetaMessage('track_name', name='Wardogs Jig', time=0),
        mido.MetaMessage('time_signature', numerator=6, denominator=8, time=0),
        mido.MetaMessage('key_signature', key='D', time=0),
        mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0),
    ])
    mid.tracks.append(meta)

    for name, ch, span in TRACKS:
        notes = part_notes(name, span)

        events = [(0, 0, mido.Message('control_change', channel=ch, control=7, value=100))]
        if 'roll' in MAP.get(name, {}):  # CC1 = Performance slider = Dynamic
            for tick, value in phrase_swell(span):
                events.append((tick, 0, mido.Message('control_change', channel=ch, control=1,
                                                     value=value)))
        elif name == 'Bouzouki':  # CC1 is tremolo on plucked instruments: keep it off
            events.append((0, 0, mido.Message('control_change', channel=ch, control=1, value=0)))
        for _, start, length, pitch, vel in notes:
            events.append((start + length, 1, mido.Message('note_off', channel=ch, note=pitch)))
            events.append((start, 2, mido.Message('note_on', channel=ch, note=pitch, velocity=vel)))
        events.sort(key=lambda e: (e[0], e[1]))

        track = mido.MidiTrack([mido.MetaMessage('track_name', name=name, time=0)])
        last = 0
        for tick, _, msg in events:
            track.append(msg.copy(time=tick - last))
            last = tick
        mid.tracks.append(track)
    return mid


if __name__ == '__main__':
    out = pathlib.Path(__file__).with_name('jig.mid')
    build().save(out)
    print(out)
