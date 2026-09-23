"""An arranged ~28s Irish reel for the 11 Spotlight Collection: Ireland instruments.

Unlike the flat v1 single, this has structure: the melody is traded between instruments
(call-and-response), instruments rest and re-enter, there is a full-band stop, dynamics rise and
fall, notes carry keyswitch ornaments + CC1 dynamics, and everything is humanized (timing and
velocity jitter, independent per instrument, so nothing lands machine-perfect).

    python make_arrangement.py        # -> arrangement.mid   (needs: pip install mido)
"""
import pathlib
import random
import sys

import mido

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'irish_jig'))
from make_jig import note_number, MAP  # noqa: E402

TPQ = 480
E = TPQ // 2            # eighth
BAR = 8 * E             # 4/4
BPM = 120
SEC_PER_TICK = 60 / (BPM * TPQ)

# --- melodic material (D major/mixolydian reel). 8 eighths per bar; NOTE or NOTE:eighths ----------
CALL = ['D5 E5 F#5 A5 F#5 D5 F#5 A5', 'B5 A5 F#5 A5 G5 F#5 E5 D5']          # the question
ANSWER = ['A5 G5 F#5 E5 D5 E5 F#5 D5', 'E5 F#5 G5 E5 F#5 E5 D5 D5']         # the resolving reply
BTHEME = ['F#5 A5 B5 A5 G5 E5 G5 A5', 'F#5 G5 A5 F#5 E5 D5 E5 C#5']         # contrasting idea
FINALE = ['D5 F#5 A5 B5 A5 F#5 A5 B5', 'A5 G5 F#5 E5 F#5 E5 D5 D5']        # big unison (<= B5, fiddle ceiling)
# chord voicings kept >= 55 so every plucked/bellows instrument can play them
TRIADS = {'D': [57, 62, 66, 69], 'G': [55, 59, 62, 67], 'A': [57, 61, 64, 69],
          'Bm': [59, 62, 66, 71], 'Em': [59, 62, 64, 67]}


def parse(bars):
    """(start_tick, len_ticks, pitch) for a list of bar strings, from t=0."""
    out, t = [], 0
    for bar in bars:
        for tok in bar.split():
            name, _, n = tok.partition(':')
            length = int(n or 1) * E
            out.append((t, length, note_number(name)))
            t += length
    return out


# --- the arrangement: sections, each a list of voices ---------------------------------------------
# A voice: (instrument, role, payload). Roles: lead/answer (motif bars), strum/pad/offbeat/arp
# (chord symbol per bar), drum. dyn scales velocity; instruments simply absent from a section rest.
def voices():
    return [
        # bar 0-1  INTRO (soft): rhythm + a plucked vamp set up the groove; leads wait
        dict(at=0, dyn=0.62, chords=['D', 'D'], parts=[
            ('Bodhran', 'drum', None), ('Bouzouki', 'strum', ['D', 'D']),
            ('Irish Harp', 'arp', ['D', 'D'])]),
        # bar 2-3  A: Tin Whistle asks the CALL, light backing
        dict(at=2, dyn=0.85, chords=['D', 'G'], parts=[
            ('Tin Whistle', 'lead', CALL), ('Bouzouki', 'strum', ['D', 'G']),
            ('Bodhran', 'drum', None), ('Irish Harp', 'arp', ['D', 'G'])]),
        # bar 4-5  A-answer: Fiddle REPLIES (whistle rests), accordion joins
        dict(at=4, dyn=0.85, chords=['A', 'D'], parts=[
            ('Fiddle', 'answer', ANSWER), ('Bouzouki', 'strum', ['A', 'D']),
            ('Button Accordion', 'pad', ['A', 'D']), ('Bodhran', 'drum', None)]),
        # bar 6-7  B: Flute + Tenor Banjo take a new idea an octave apart; concertina chops
        dict(at=6, dyn=0.9, chords=['G', 'D'], parts=[
            ('Irish Flute', 'lead', BTHEME), ('Tenor Banjo', 'lead8', BTHEME),
            ('Concertina', 'offbeat', ['G', 'D']), ('Irish Harp', 'arp', ['G', 'D']),
            ('Bodhran', 'drum', None)]),
        # bar 8-9  B2: Mandolin answers, builds; a STOP lands on the last beat of bar 9
        dict(at=8, dyn=0.95, chords=['Em', 'A'], stop=True, parts=[
            ('Mandolin', 'lead', ANSWER), ('Bouzouki', 'strum', ['Em', 'A']),
            ('Button Accordion', 'pad', ['Em', 'A']), ('Bodhran', 'drum', None)]),
        # bar 10-12  A' FINALE (loud): whistle+fiddle+pipes in unison, full band drives
        dict(at=10, dyn=1.1, chords=['D', 'G', 'A'], parts=[
            ('Tin Whistle', 'lead', FINALE + [FINALE[0]]), ('Fiddle', 'lead', FINALE + [FINALE[0]]),
            ('Uilleann Pipes', 'lead', FINALE + [FINALE[0]]),
            ('Mandolin', 'strum', ['D', 'G', 'A']), ('Bouzouki', 'strum', ['D', 'G', 'A']),
            ('Button Accordion', 'pad', ['D', 'G', 'A']), ('Concertina', 'offbeat', ['D', 'G', 'A']),
            ('Irish Harp', 'arp', ['D', 'G', 'A']), ('Tenor Banjo', 'lead8', FINALE + [FINALE[0]]),
            ('Bodhran', 'drum', None)]),
        # bar 13  TAG: held D chord across the band, let ring
        dict(at=13, dyn=1.1, chords=['D'], tag=True, parts=[
            ('Tin Whistle', 'hold', 'D5'), ('Fiddle', 'hold', 'A4'), ('Uilleann Pipes', 'hold', 'D5'),
            ('Irish Flute', 'hold', 'F#4'), ('Bouzouki', 'strum', ['D']), ('Mandolin', 'strum', ['D']),
            ('Button Accordion', 'pad', ['D']), ('Concertina', 'pad', ['D']),
            ('Irish Harp', 'arp', ['D']), ('Bodhran', 'drum', None)]),
    ]


# --- rendering with articulation, velocity and humanization ---------------------------------------
def hum(rng, notes, time_sd, vel_sd):
    """Independent per-note timing (ticks) + velocity jitter so nothing is machine-aligned.
    Keyswitches (pitch < 36) are left locked to their notes so the articulation never slips off."""
    out = []
    for t, length, pitch, vel in notes:
        if pitch < 36:
            out.append((t, length, pitch, vel))
            continue
        t2 = max(0, t + int(rng.gauss(0, time_sd)))
        out.append((t2, int(length * rng.uniform(0.9, 1.0)), pitch,
                    int(max(1, min(127, vel + rng.gauss(0, vel_sd))))))
    return out


def lilt(pos):
    return 1.0 if pos in (0, 3, 4) else 0.82   # lean on 1, the & of 2, and 3


def render_lead(instr, bars, base_dyn, rng, shift=0):
    """Melody with legato overlaps, keyswitch ornaments and a CC1 swell."""
    m = MAP.get(instr, {})
    notes = parse(bars)
    out, cc = [], []
    span = notes[-1][0] + notes[-1][1]
    for i, (t, length, p) in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        legato = nxt is not None and nxt[2] != p
        dur = length + 22 if legato else int(length * 0.9)
        pos = (t % BAR) // E
        vel = int(96 * base_dyn * lilt(pos))
        out.append((t, dur, p + shift, vel))
        # ornament: roll on long notes, cut on strong beats, slide/strike to open a phrase
        ks = None
        if length >= 3 * E and 'roll' in m:
            ks = m['roll']
        elif pos in (0, 4) and length <= E and 'cut' in m and rng.random() < 0.5:
            ks = m['cut']
        elif t % (2 * BAR) == 0 and m.get('start'):
            ks = m['start']
        if ks:
            out.append((max(0, t - 20), length, ks, 100))
    # CC1 dynamic swell across the phrase (only where CC1 = Dynamic, i.e. wind/bowed)
    if instr in ('Tin Whistle', 'Fiddle', 'Uilleann Pipes', 'Irish Flute', 'Concertina', 'Button Accordion'):
        for b in range(0, span, E):
            frac = b / span
            cc.append((b, int(64 + 40 * (frac if frac < 0.7 else (1 - frac) / 0.3 * 0.7 + 0.3) * base_dyn)))
    return out, cc


def render_strum(instr, chords, base_dyn, rng):
    m = MAP.get(instr, {})
    down, up = m.get('downstroke', 24), m.get('upstroke', m.get('upstroke', 25))
    out = []
    for b, sym in enumerate(chords):
        t0 = b * BAR
        for e in range(8):
            voic = TRIADS[sym]
            is_down = e % 2 == 0
            vel = int((92 if e in (0, 4) else 72) * base_dyn)
            for k, p in enumerate(voic if is_down else voic[::-1]):
                out.append((t0 + e * E + 5 * k, int(E * 0.85), p, max(1, vel - 5 * k)))
            if 'downstroke' in m:                       # strum-direction keyswitch (plucked family)
                out.append((t0 + e * E - 18, E, down if is_down else up, 100))
    return out


def render_pad(instr, chords, base_dyn):
    out = []
    for b, sym in enumerate(chords):
        for p in TRIADS[sym][1:]:
            out.append((b * BAR, BAR - 20, p, int(66 * base_dyn)))
    return out


def render_offbeat(instr, chords, base_dyn):
    out = []
    for b, sym in enumerate(chords):
        for e in (2, 6):
            for p in TRIADS[sym][1:]:
                out.append((b * BAR + e * E, E, p, int(64 * base_dyn)))
    return out


def render_arp(instr, chords, base_dyn):
    out = []
    for b, sym in enumerate(chords):
        shape = TRIADS[sym] + [n + 12 for n in TRIADS[sym][:3]]
        for e in range(8):
            out.append((b * BAR + e * E, E + 24, shape[e % len(shape)], int(60 * base_dyn)))
    return out


def render_drum(base_dyn, rng):
    dn, up, dacc, uacc, ghost = 60, 61, 65, 66, 69
    out = []
    for b in range(2):
        t0 = b * BAR
        for e in range(8):
            key = dacc if e == 0 else uacc if e == 4 else (dn if e % 2 == 0 else up)
            if e in (3, 7) and rng.random() < 0.4:
                key = ghost
            vel = int((110 if e in (0, 4) else 70) * base_dyn)
            out.append((t0 + e * E, E // 2, key, vel))
    return out


TIME_SD = {'lead': 11, 'answer': 11, 'lead8': 11, 'strum': 8, 'pad': 6, 'offbeat': 8,
           'arp': 9, 'drum': 5, 'hold': 6}

# The Ireland instruments LATCH the last keyswitch, so a note with no articulation plays whatever
# was left on before. Every entry's first note holds this "known-normal" keyswitch to reset that.
DEFAULT_KS = {
    'Tin Whistle': 25, 'Fiddle': 25, 'Uilleann Pipes': 25, 'Irish Flute': 25,   # Long (natural legato)
    'Concertina': 25, 'Button Accordion': 25,                                    # Long (sustained)
    'Bouzouki': 24, 'Mandolin': 24, 'Tenor Banjo': 24, 'Irish Harp': 24,         # Short / Downstroke / Thumb
}


def ensure_first_ks(instr, ev):
    """Guarantee the first note of this entry holds a keyswitch, so no stale latch leaks through."""
    mel = [e for e in ev if e[2] >= 36]
    if not mel or instr not in DEFAULT_KS:
        return ev
    ft = min(e[0] for e in mel)
    flen = next(e[1] for e in mel if e[0] == ft)
    if any(e[2] < 36 and e[0] <= ft + 20 for e in ev):     # an ornament already opens this entry
        return ev
    return ev + [(max(0, ft - 20), flen, DEFAULT_KS[instr], 92)]


def build():
    parts = {name: {'notes': [], 'cc': []} for name, ch, r in CUBASE_TRACKS}
    for sec in voices():
        at = sec['at'] * BAR
        for entry in sec['parts']:
            instr, role, payload = entry
            rng = random.Random(hash((instr, sec['at'])) & 0xffffffff)
            cc = []
            if role in ('lead', 'answer'):
                ev, cc = render_lead(instr, payload, sec['dyn'], rng)
            elif role == 'lead8':
                ev, cc = render_lead(instr, payload, sec['dyn'], rng, shift=-12)
            elif role == 'strum':
                ev = render_strum(instr, payload, sec['dyn'], rng)
            elif role == 'pad':
                ev = render_pad(instr, payload, sec['dyn'])
            elif role == 'offbeat':
                ev = render_offbeat(instr, payload, sec['dyn'])
            elif role == 'arp':
                ev = render_arp(instr, payload, sec['dyn'])
            elif role == 'drum':
                ev = render_drum(sec['dyn'], rng)
            elif role == 'hold':
                ev = [(0, BAR - 40, note_number(payload), int(90 * sec['dyn']))]
            else:
                continue
            ev = ensure_first_ks(instr, ev)      # deterministic articulation at every entry
            # a STOP: cut everything on the last beat of the section's last bar
            if sec.get('stop'):
                cut = (len(sec['chords'])) * BAR - 2 * E
                ev = [(t, min(l, cut - t), p, v) for t, l, p, v in ev if t < cut]
            ev = hum(rng, ev, TIME_SD.get(role, 8), 6)
            parts[instr]['notes'] += [(at + t, l, p, v) for t, l, p, v in ev]
            parts[instr]['cc'] += [(at + t, v) for t, v in cc]
    return parts


# name, channel, (unused role tag). Order MUST match Cubase's track order for recording.
CUBASE_TRACKS = [
    ('Bouzouki', 0, ''), ('Button Accordion', 1, ''), ('Concertina', 2, ''), ('Fiddle', 3, ''),
    ('Irish Flute', 4, ''), ('Irish Harp', 5, ''), ('Mandolin', 6, ''), ('Tenor Banjo', 7, ''),
    ('Tin Whistle', 8, ''), ('Bodhran', 9, ''), ('Uilleann Pipes', 10, ''),
]


def write(path):
    parts = build()
    mid = mido.MidiFile(type=1, ticks_per_beat=TPQ)
    mid.tracks.append(mido.MidiTrack([
        mido.MetaMessage('track_name', name='Wardogs Irish Reel', time=0),
        mido.MetaMessage('time_signature', numerator=4, denominator=4, time=0),
        mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0)]))
    for name, ch, _ in CUBASE_TRACKS:
        data = parts[name]
        lo, hi = MAP[name]['range']
        bad = sorted({p for _, _, p, _ in data['notes'] if p >= 36 and not lo <= p <= hi})
        if bad:
            raise SystemExit(f'{name}: notes {bad} outside range {lo}-{hi}')
        ev = []
        for t, value in data['cc']:
            ev.append((t, 0, mido.Message('control_change', channel=ch, control=1, value=value)))
        for t, length, p, v in data['notes']:
            ev.append((t + length, 1, mido.Message('note_off', channel=ch, note=p)))
            ev.append((t, 2, mido.Message('note_on', channel=ch, note=p, velocity=v)))
        ev.sort(key=lambda e: (e[0], e[1]))
        track = mido.MidiTrack([mido.MetaMessage('track_name', name=name, time=0)])
        last = 0
        for tick, _, msg in ev:
            track.append(msg.copy(time=tick - last))
            last = tick
        mid.tracks.append(track)
    mid.save(path)
    return mid


if __name__ == '__main__':
    out = pathlib.Path(__file__).with_name('arrangement.mid')
    m = write(out)
    print(out, f'{m.length:.1f}s')
