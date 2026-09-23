"""A 10-second Irish reel in D, all 11 Spotlight Collection: Ireland instruments.

120 bpm, 4/4, 5 bars (4-bar phrase + a held tag) = exactly 10.0 s. Written for the WARDOGS
Cubase template: one named track per instrument, each on its own MIDI channel. Everything sits in
each instrument's playable range with Key Mode = Chromatic (no keyswitches for v1), and the melodic
leads use overlapping notes so the legato samples engage.

    python make_single.py        # -> single.mid  (needs: pip install mido)
"""
import pathlib

import mido

# reuse the note parser and the verified per-instrument ranges from the jig
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'irish_jig'))
from make_jig import note_number, MAP  # noqa: E402

TPQ = 480
EIGHTH = TPQ // 2
BAR = 8 * EIGHTH            # 4/4
BPM = 120

# --- the tune -------------------------------------------------------------------------------------
# 8 eighths per bar. NOTE or NOTE:eighths. The reel melody (D major).
MELODY = [
    'D5 E5 F#5 A5 F#5 E5 D5 F#5',   # bar 1  (D)
    'G5 F#5 E5 G5 B5 A5 G5 F#5',    # bar 2  (G)
    'E5 F#5 G5 A5 B5 A5 G5 F#5',    # bar 3  (A)
    'D5 F#5 A5 F#5 E5 C#5 D5 D5',   # bar 4  (D)
    'D5:8',                         # bar 5  (D) held tag
]
CHORDS = ['D', 'G', 'A', 'D', 'D']
TRIAD = {'D': [57, 62, 66], 'G': [55, 59, 62], 'A': [57, 61, 64]}   # A3-ish voicings, 55-66

# name, channel (0-based; 9 = GM drums), role
TRACKS = [
    ('Bodhran', 9, 'drum'),
    ('Bouzouki', 0, 'strum'),
    ('Button Accordion', 1, 'pad'),
    ('Concertina', 2, 'offbeat'),
    ('Fiddle', 3, 'melody'),
    ('Irish Flute', 4, 'melody8'),      # octave below
    ('Irish Harp', 5, 'arp'),
    ('Mandolin', 6, 'strum'),
    ('Tenor Banjo', 7, 'melody8'),
    ('Tin Whistle', 8, 'melody'),
    ('Uilleann Pipes', 10, 'melody'),
]
SAFE = (48, 84)   # range for instruments we haven't mapped; clear of keyswitch/phrase zones


def tune():
    """(start_tick, length_ticks, pitch) for the melody."""
    out, t = [], 0
    for bar in MELODY:
        for tok in bar.split():
            name, _, n = tok.partition(':')
            length = int(n or 1) * EIGHTH
            out.append((t, length, note_number(name)))
            t += length
    return out


def chord_at(tick):
    return CHORDS[min(tick // BAR, len(CHORDS) - 1)]


def melody_part(shift):
    notes = tune()
    out = []
    for i, (t, length, p) in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        legato = nxt is not None and nxt[2] != p + shift
        dur = length + 18 if legato else int(length * 0.9)
        vel = 104 if t % BAR == 0 else 86
        out.append((t, dur, p + shift, vel))
    return out


def strum_part():
    """Eighth-note chord strums, down-up feel via a tiny roll."""
    out = []
    for b in range(len(MELODY)):
        t0 = b * BAR
        hits = [0] if b == len(MELODY) - 1 else range(8)
        for e in hits:
            voic = TRIAD[chord_at(t0)]
            length = (BAR if b == len(MELODY) - 1 else EIGHTH)
            vel = 96 if e % 2 == 0 else 74
            for k, p in enumerate(voic):
                out.append((t0 + e * EIGHTH + 6 * k, int(length * 0.85), p, vel - 4 * k))
    return out


def pad_part():
    """Sustained chords, one per bar."""
    out = []
    for b in range(len(MELODY)):
        for p in TRIAD[chord_at(b * BAR)]:
            out.append((b * BAR, BAR - 20, p, 70))
    return out


def offbeat_part():
    """Chords on beats 2 and 4 (the reel 'chop')."""
    out = []
    for b in range(len(MELODY)):
        t0 = b * BAR
        beats = [0] if b == len(MELODY) - 1 else [2, 6]  # eighth positions of beats 2 and 4
        for e in beats:
            for p in TRIAD[chord_at(t0)]:
                out.append((t0 + e * EIGHTH, EIGHTH, p, 68))
    return out


def arp_part():
    """Harp: rolling arpeggio of the bar's chord, one note per eighth, spanning two octaves."""
    out = []
    for b in range(len(MELODY)):
        t0 = b * BAR
        voic = TRIAD[chord_at(t0)]
        shape = voic + [n + 12 for n in voic] + [voic[0] + 24]
        if b == len(MELODY) - 1:
            for p in [voic[0], voic[1], voic[2], voic[0] + 12]:   # final rolled chord, let ring
                out.append((t0, BAR, p, 78))
        else:
            for e in range(8):
                out.append((t0 + e * EIGHTH, EIGHTH + 30, shape[e % len(shape)], 66))
    return out


def drum_part():
    """Bodhran reel: single hits (60-83), accents on beats 1 and 3."""
    down, up, dacc, uacc = 60, 61, 65, 66
    out = []
    for b in range(len(MELODY)):
        t0 = b * BAR
        if b == len(MELODY) - 1:
            out.append((t0, EIGHTH, dacc, 118))
            continue
        for e in range(8):
            accent = e in (0, 4)
            key = dacc if e == 0 else uacc if e == 4 else (down if e % 2 == 0 else up)
            out.append((t0 + e * EIGHTH, EIGHTH // 2, key, 112 if accent else 70))
    return out


BUILDERS = {
    'melody': lambda: melody_part(0), 'melody8': lambda: melody_part(-12),
    'strum': strum_part, 'pad': pad_part, 'offbeat': offbeat_part, 'arp': arp_part,
    'drum': drum_part,
}


def build():
    mid = mido.MidiFile(type=1, ticks_per_beat=TPQ)
    meta = mido.MidiTrack([
        mido.MetaMessage('track_name', name='Wardogs Irish Single', time=0),
        mido.MetaMessage('time_signature', numerator=4, denominator=4, time=0),
        mido.MetaMessage('key_signature', key='D', time=0),
        mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0),
    ])
    mid.tracks.append(meta)

    for name, ch, role in TRACKS:
        notes = BUILDERS[role]()
        lo, hi = MAP[name]['range'] if name in MAP else SAFE
        bad = sorted({p for _, _, p, _ in notes if not lo <= p <= hi})
        if bad:
            raise SystemExit(f'{name}: notes {bad} outside range {lo}-{hi}')

        events = [(0, 0, mido.Message('control_change', channel=ch, control=7, value=100))]
        for start, length, pitch, vel in notes:
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
    out = pathlib.Path(__file__).with_name('single.mid')
    build().save(out)
    print(out)
