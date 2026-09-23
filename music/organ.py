"""Additive pipe-organ synthesiser and song renderer. numpy only, no samples.

Every sound is generated from sine partials, so the output contains no third-party
recordings and nothing for YouTube Content ID to match against.
"""
import itertools
import struct
import wave

import numpy as np

SR = 44100
_LETTER = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def note_number(name):
    """'C#5' -> 73, 'Bb4' -> 70 (C4 = 60)."""
    i, acc = 1, 0
    while i < len(name) and name[i] in '#b':
        acc += 1 if name[i] == '#' else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + _LETTER[name[0].upper()] + acc


# --- notation -------------------------------------------------------------------------

def parse_melody(text, bpb):
    """'D5:2 A4:1 r:1 | G5:4 | ~:4' -> [[beat, pitch, beats]], bar count.
    'r' is a rest, '~' ties onto the previous note. Every bar must add up to bpb."""
    notes, t = [], 0.0
    bars = text.split('|')
    for i, bar in enumerate(bars):
        total = 0.0
        for tok in bar.split():
            name, d = tok.split(':')
            d = float(d)
            if name == '~':
                notes[-1][2] += d
            elif name != 'r':
                notes.append([t, note_number(name), d])
            t += d
            total += d
        if abs(total - bpb) > 1e-9:
            raise ValueError(f'bar {i + 1} has {total} beats, expected {bpb}: {bar.strip()}')
    return notes, len(bars)


_QUALITY = {'': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10), 'm7': (0, 3, 7, 10), 'dim': (0, 3, 6)}


def parse_chord(sym):
    """'Bb' -> [10, 2, 5]: root, third, fifth(, seventh) as pitch classes."""
    i, acc = 1, 0
    while i < len(sym) and sym[i] in '#b':
        acc += 1 if sym[i] == '#' else -1
        i += 1
    root = (_LETTER[sym[0]] + acc) % 12
    return [(root + x) % 12 for x in _QUALITY[sym[i:]]]


def voice_chord(pcs, prev, top, low=50):
    """Three close-position chord tones below `top`, moving as little as possible from `prev`."""
    cands = [n for n in range(low, top + 1) if n % 12 in pcs]
    best = None
    for combo in itertools.combinations(cands, 3):
        present = {n % 12 for n in combo}
        if not {pcs[0], pcs[1]} <= present or combo[2] - combo[0] > 12:
            continue
        cost = sum(abs(a - b) for a, b in zip(combo, prev)) if prev else abs(sum(combo) / 3 - 60)
        cost += 0 if len(present) == 3 else 3
        if best is None or cost < best[0]:
            best = (cost, combo)
    if best is None:
        return voice_chord(pcs, prev, top, low - 5)
    return best[1]


# --- accompaniment patterns: (offset, beats) for the chords, (offset, beats, degree) for the pedal

def pattern(name, span, bar_index):
    if name == 'chorale':
        return [(0, span)], [(0, span, 'root')]
    if name == 'march':
        beats = range(int(span))
        return ([(b + 0.5, 0.3) for b in beats],
                [(b, 0.55, 'root' if b % 2 == 0 else 'fifth') for b in beats])
    if name == 'waltz':
        return [(1, 0.8), (2, 0.8)], [(0, 1.0, 'root' if bar_index % 2 == 0 else 'fifth')]
    raise ValueError(name)


def pedal_note(pcs, degree):
    root = 36 + pcs[0]
    if root > 47:
        root -= 12
    if degree == 'root':
        return root
    return root + 7 if root + 7 <= 50 else root - 5


# --- organ ----------------------------------------------------------------------------

# Relative harmonic amplitudes of single pipe ranks.
RANK = {
    'principal': [1, .5, .33, .2, .14, .1, .07, .05, .035, .025, .018, .012],
    'flute':     [1, .08, .12, .02, .03],
    'gedackt':   [1, 0, .22, 0, .07, 0, .03],
    'gamba':     [1, .75, .6, .5, .42, .35, .3, .25, .21, .18, .15, .12, .1, .08],
    'trumpet':   [.8, 1, .9, .8, .7, .6, .5, .42, .35, .28, .22, .18, .14, .11, .09, .07],
    'oboe':      [.5, .8, 1, .7, .5, .35, .25, .18, .12, .08],
}

# Stops: (rank, pitch multiplier, level). Multiplier 1 = 8', 2 = 4', 3 = 2 2/3', 0.5 = 16'.
_PLENUM = [('principal', 1, 1), ('principal', 2, .55), ('principal', 3, .25),
           ('principal', 4, .3), ('principal', 6, .12), ('principal', 8, .1)]
REG = {
    'flute8':       dict(stops=[('flute', 1, 1)]),
    'flute8_4':     dict(stops=[('flute', 1, 1), ('flute', 2, .45)]),
    'flute_trem':   dict(stops=[('flute', 1, 1), ('flute', 2, .4)], trem=True),
    'celeste':      dict(stops=[('gamba', 1, .6), ('gamba', 1.003, .6), ('flute', 1, .4)]),
    'principal8':   dict(stops=[('principal', 1, 1)]),
    'principal8_4': dict(stops=[('principal', 1, 1), ('principal', 2, .5)]),
    'plenum_soft':  dict(stops=[('principal', 1, 1), ('flute', 1, .6), ('principal', 2, .35)]),
    'plenum':       dict(stops=_PLENUM),
    'trumpet':      dict(stops=[('trumpet', 1, 1), ('principal', 1, .4)]),
    'full':         dict(stops=_PLENUM + [('trumpet', 1, .8)]),
    'oboe':         dict(stops=[('oboe', 1, 1), ('flute', 1, .4)], trem=True),
    'pedal_soft':   dict(stops=[('gedackt', .5, 1), ('flute', 1, .5)]),
    'pedal':        dict(stops=[('gedackt', .5, 1), ('principal', 1, .6), ('flute', 2, .2)]),
    'pedal_full':   dict(stops=[('gedackt', .5, 1), ('principal', 1, .8), ('principal', 2, .4),
                                ('trumpet', 1, .35)]),
}


def synth_note(pitch, seconds, reg, rng, release=0.15, attack=0.03):
    stops = REG[reg]['stops']
    trem = REG[reg].get('trem', False)
    n = int((seconds + release) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    freq = 440.0 * 2 ** ((pitch - 69) / 12)
    for rank, mult, level in stops:
        f0 = freq * mult * 2 ** (rng.uniform(-3, 3) / 1200)  # pipes are never perfectly in tune
        for k, a in enumerate(RANK[rank], 1):
            f = f0 * k
            if a == 0 or f > 15000:
                continue
            if f > 2000:
                a *= 2000 / f  # soften the top end
            phase = 2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)
            if trem:
                phase += (f * 0.0025 / 5.6) * np.sin(2 * np.pi * 5.6 * t)
            y += level * a * np.sin(phase)
    y /= np.sqrt(sum(s[2] for s in stops))
    env = np.ones(n)
    a = int(attack * SR)
    env[:a] = np.linspace(0, 1, a) ** 1.5
    r = int(seconds * SR)
    env[r:] = np.linspace(1, 0, n - r) ** 2
    if trem:
        env *= 1 + 0.12 * np.sin(2 * np.pi * 5.6 * t)
    return y * env


def reverb(x, rt60, rng):
    """Stereo convolution with a synthetic hall: early taps + darkening exponential tail."""
    n = int(rt60 * 1.3 * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * 10 ** (-3 * t / rt60)
    spec = np.fft.rfft(ir, axis=1)
    f = np.fft.rfftfreq(n, 1 / SR)
    ir = np.fft.irfft(spec / (1 + (f / 3500) ** 2), n, axis=1)
    ir[:, :int(0.025 * SR)] = 0  # pre-delay
    for d, g in [(0.011, .5), (0.019, .4), (0.027, .35), (0.037, .3)]:
        ir[0, int(d * SR)] += g
        ir[1, int((d + 0.004) * SR)] += g
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size, axis=1) * np.fft.rfft(ir, size, axis=1), size, axis=1)
    return wet[:, :x.shape[1]]


# --- song -----------------------------------------------------------------------------

LEVEL = {'melody': 1.0, 'harmony': 0.42, 'pedal': 0.75}
ARTIC = {'melody': 0.95, 'harmony': 1.0, 'pedal': 1.0}


def arrange(song):
    """Expand sections into note events and a beat -> seconds map."""
    bpb = song['bpb']
    events = []            # [beat, beats, pitch, voice, reg, vel]
    grid_b, grid_s = [0.0], [0.0]
    tempo_marks = []       # (beat, bpm) for the MIDI tempo track
    beat0, prev_voicing = 0.0, None
    step = 1 / 48
    for sec in song['sections']:
        mel, nbars = parse_melody(sec['melody'], bpb)
        chords = sec['chords'].split()
        if len(chords) != nbars:
            raise ValueError(f"{sec['name']}: {nbars} melody bars but {len(chords)} chord bars")
        length = nbars * bpb
        bpm0 = sec.get('tempo', song['tempo'])
        for i in range(int(round(length / step))):
            frac = i * step / length
            bpm = bpm0 * (1 - 0.3 * frac) if sec.get('rit') else bpm0
            grid_b.append(grid_b[-1] + step)
            grid_s.append(grid_s[-1] + step * 60 / bpm)
        if sec.get('rit'):
            tempo_marks += [(beat0 + b, bpm0 * (1 - 0.3 * b / length)) for b in range(int(length))]
        else:
            tempo_marks.append((beat0, bpm0))

        reg, dyn = sec['reg'], sec.get('dyn', 1.0)
        for start, pitch, dur in mel:
            events.append([beat0 + start, dur, pitch, 'melody', reg['melody'], dyn])

        for bar, sym in enumerate(chords):
            parts = sym.split(',')
            span = bpb / len(parts)
            for j, part in enumerate(parts):
                s0 = bar * bpb + j * span
                pcs = parse_chord(part)
                above = [p for st, p, d in mel if st < s0 + span and st + d > s0]
                voicing = voice_chord(pcs, prev_voicing, (min(above) if above else 73) - 1)
                prev_voicing = voicing
                harm, ped = pattern(sec['accomp'], span, bar)
                for off, d in harm:
                    for p in voicing:
                        events.append([beat0 + s0 + off, d, p, 'harmony', reg['harmony'], dyn])
                for off, d, degree in ped:
                    events.append([beat0 + s0 + off, d, pedal_note(pcs, degree), 'pedal',
                                   reg['pedal'], dyn])
        beat0 += length

    # sustained chords that repeat the same pipe are held, not re-struck
    events.sort(key=lambda e: (e[3], e[2], e[0]))
    merged = []
    for e in events:
        m = merged[-1] if merged else None
        if (m and e[3] != 'melody' and m[3] == e[3] and m[2] == e[2] and m[4] == e[4]
                and abs(m[0] + m[1] - e[0]) < 1e-9):
            m[1] += e[1]
        else:
            merged.append(e)
    merged.sort(key=lambda e: e[0])
    grid_b, grid_s = np.array(grid_b), np.array(grid_s)
    return merged, (lambda b: np.interp(b, grid_b, grid_s)), tempo_marks, beat0


def render(song, wav_path, midi_path):
    rng = np.random.default_rng(song.get('seed', 1))
    events, to_sec, tempo_marks, total_beats = arrange(song)
    tail = song.get('rt60', 3.0) + 1.0
    total = to_sec(total_beats) + tail
    mix = np.zeros((2, int(total * SR) + SR))
    for beat, dur, pitch, voice, reg, dyn in events:
        start = to_sec(beat) + rng.normal(0, 0.004) * (voice != 'pedal')
        secs = to_sec(beat + dur * ARTIC[voice]) - to_sec(beat)
        y = synth_note(pitch, secs, reg, rng) * LEVEL[voice] * dyn
        pan = 0.0 if voice == 'pedal' else np.clip((pitch - 62) / 40, -.45, .45)
        i = max(0, int(start * SR))
        mix[0, i:i + len(y)] += y * np.cos((pan + 1) * np.pi / 4)
        mix[1, i:i + len(y)] += y * np.sin((pan + 1) * np.pi / 4)
    mix = mix[:, :int(total * SR)]
    out = 0.75 * mix + song.get('wet', 0.45) * reverb(mix, song.get('rt60', 3.0), rng)
    fade = int(1.5 * SR)
    out[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    out *= 10 ** (-1 / 20) / np.abs(out).max()  # peak at -1 dBFS
    pcm = (out.T * 32767).astype('<i2')
    with wave.open(str(wav_path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    write_midi(midi_path, song['title'], events, tempo_marks)
    return total


# --- MIDI -----------------------------------------------------------------------------

def _vlq(n):
    out = [n & 0x7F]
    while n > 0x7F:
        n >>= 7
        out.insert(0, (n & 0x7F) | 0x80)
    return bytes(out)


def _track(msgs):
    msgs.sort(key=lambda m: (m[0], m[1]))
    data, last = b'', 0
    for tick, _, raw in msgs:
        data += _vlq(tick - last) + raw
        last = tick
    data += b'\x00\xff\x2f\x00'
    return b'MTrk' + struct.pack('>I', len(data)) + data


def write_midi(path, title, events, tempo_marks, tpq=480):
    """Type-1 file, one Church Organ (GM 20) track per voice, with the exact tempo map."""
    name = title.encode('utf-8')
    tracks = [_track([(0, 0, b'\xff\x03' + _vlq(len(name)) + name)] +
                     [(int(round(b * tpq)), 1, b'\xff\x51\x03' + int(60e6 / bpm).to_bytes(3, 'big'))
                      for b, bpm in tempo_marks])]
    for ch, voice in enumerate(['melody', 'harmony', 'pedal']):
        vname = voice.encode()
        msgs = [(0, 0, b'\xff\x03' + _vlq(len(vname)) + vname), (0, 1, bytes([0xC0 | ch, 19]))]
        for beat, dur, pitch, v, reg, dyn in events:
            if v != voice:
                continue
            on, off = int(round(beat * tpq)), int(round((beat + dur * ARTIC[v]) * tpq))
            vel = int(np.clip(90 * LEVEL[v] ** 0.3 * dyn, 1, 127))
            msgs.append((off, 2, bytes([0x80 | ch, pitch, 0])))
            msgs.append((on, 3, bytes([0x90 | ch, pitch, vel])))
        tracks.append(_track(msgs))
    with open(path, 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), tpq) + b''.join(tracks))
