"""Three original organ pieces in a Russian idiom. All melodies are written from scratch.

Melody notation: NOTE:beats, 'r' = rest, '~' = tie onto the previous note, '|' = bar line.
Chords: one symbol per bar; 'Dm,A' splits a bar in two.
"""

# 1. Колокола (Bells) - slow Orthodox-style chorale, D minor, 4/4.
_BELLS_A = ('D5:2 A4:1 D5:1 | G5:1.5 F5:0.5 D5:2 | E5:1 G5:1 F5:1 E5:1 | F5:4 | '
            'D5:2 F5:1 D5:1 | Bb4:1 D5:1 G5:2 | F5:1 E5:1 C#5:2 | D5:4')
_BELLS_A2 = ('A5:2 F5:1 D5:1 | G5:1 Bb5:1 A5:1 G5:1 | G5:2 E5:1 C5:1 | F5:2 A5:2 | '
             'Bb5:1.5 A5:0.5 G5:1 F5:1 | G5:1 F5:1 E5:1 D5:1 | E5:2 C#5:2 | D5:4')
BELLS = dict(
    title='Kolokola (Bells)', slug='01_kolokola', tempo=66, bpb=4, rt60=4.0, wet=0.55, seed=11,
    sections=[
        dict(name='intro', accomp='chorale', dyn=0.7, chords='Dm Dm',
             melody='D5:1 A4:1 F4:1 A4:1 | D5:1 A4:1 F4:1 A4:1',
             reg=dict(melody='flute8_4', harmony='flute8', pedal='pedal_soft')),
        dict(name='A', accomp='chorale', chords='Dm Gm C F Bb Gm A Dm', melody=_BELLS_A,
             reg=dict(melody='principal8_4', harmony='principal8', pedal='pedal')),
        dict(name="A'", accomp='chorale', dyn=1.1, chords='Dm Gm C F Bb Gm A Dm', melody=_BELLS_A2,
             reg=dict(melody='plenum', harmony='plenum_soft', pedal='pedal_full')),
        dict(name='coda', accomp='chorale', dyn=1.1, rit=True, chords='Bb C A Dm D',
             melody='F5:2 D5:2 | E5:2 G5:2 | E5:2 C#5:2 | D5:4 | ~:4',
             reg=dict(melody='full', harmony='plenum_soft', pedal='pedal_full')),
    ])

# 2. Марш (March) - military march, A minor, 2/4.
_MARCH_A = ('A4:0.75 B4:0.25 C5:0.5 A4:0.5 | E5:0.5 E5:0.5 E5:1 | F5:0.75 E5:0.25 D5:0.5 F5:0.5 | '
            'E5:1.5 r:0.5 | D5:0.75 E5:0.25 F5:0.5 D5:0.5 | C5:0.75 D5:0.25 E5:0.5 C5:0.5 | '
            'C5:0.5 B4:0.5 A4:0.5 C5:0.5 | B4:1.5 r:0.5 | '
            'A4:0.75 B4:0.25 C5:0.5 A4:0.5 | E5:0.5 E5:0.5 E5:1 | F5:0.75 E5:0.25 D5:0.5 F5:0.5 | '
            'E5:1.5 r:0.5 | F5:0.75 F5:0.25 A5:0.5 F5:0.5 | E5:0.75 E5:0.25 C5:0.5 A4:0.5 | '
            'G#4:0.5 B4:0.5 E5:0.5 D5:0.5 | C5:0.5 B4:0.5 A4:1')
_MARCH_A_CH = 'Am Am Dm Am Dm Am Am E Am Am Dm Am Dm Am E Am'
_MARCH_B = ('G5:0.75 E5:0.25 C5:0.5 E5:0.5 | D5:1 G4:1 | B4:0.75 C5:0.25 D5:0.5 F5:0.5 | '
            'E5:1.5 r:0.5 | A5:0.75 G5:0.25 F5:0.5 A5:0.5 | G5:0.75 F5:0.25 E5:0.5 C5:0.5 | '
            'D5:0.5 F5:0.5 E5:0.5 D5:0.5 | D5:1.5 r:0.5 | '
            'G5:0.75 E5:0.25 C5:0.5 E5:0.5 | D5:1 G4:1 | A5:0.75 G5:0.25 F5:0.5 E5:0.5 | '
            'E5:1 C5:1 | F5:0.5 E5:0.5 D5:0.5 C5:0.5 | C5:0.5 B4:0.5 A4:0.5 C5:0.5 | '
            'B4:0.5 G#4:0.5 B4:0.5 E5:0.5 | E5:1.5 r:0.5')
MARCH = dict(
    title='Marsh (March)', slug='02_marsh', tempo=112, bpb=2, rt60=2.2, wet=0.4, seed=22,
    sections=[
        dict(name='intro', accomp='march', chords='Am Am E E',
             melody='A4:0.75 A4:0.25 A4:0.5 E5:0.5 | A5:1.5 r:0.5 | '
                    'G#4:0.75 G#4:0.25 B4:0.5 E5:0.5 | E5:1.5 r:0.5',
             reg=dict(melody='trumpet', harmony='principal8', pedal='pedal')),
        dict(name='A', accomp='march', chords=_MARCH_A_CH, melody=_MARCH_A,
             reg=dict(melody='trumpet', harmony='principal8', pedal='pedal')),
        dict(name="A'", accomp='march', dyn=1.1, chords=_MARCH_A_CH, melody=_MARCH_A,
             reg=dict(melody='full', harmony='plenum_soft', pedal='pedal_full')),
        dict(name='B', accomp='march', dyn=0.9, chords='C G G C F C Dm G C G F C Dm Am E E',
             melody=_MARCH_B, reg=dict(melody='principal8_4', harmony='flute8_4', pedal='pedal')),
        dict(name="A''", accomp='march', dyn=1.15, chords=_MARCH_A_CH, melody=_MARCH_A,
             reg=dict(melody='full', harmony='plenum', pedal='pedal_full')),
        dict(name='tag', accomp='chorale', dyn=1.15, rit=True, chords='E Am Am',
             melody='B4:0.75 B4:0.25 E5:1 | A5:2 | ~:2',
             reg=dict(melody='full', harmony='plenum', pedal='pedal_full')),
    ])

# 3. Степь (Steppe) - melancholy waltz, E minor, 3/4.
_STEPPE_A = ('B4:1 E5:1 G5:1 | B5:2 A5:1 | A5:1.5 G5:0.5 E5:1 | E5:3 | F#5:1 A5:1 F#5:1 | '
             'G5:2 D5:1 | E5:1 G5:1 E5:1 | D#5:2 B4:1 | B4:1 E5:1 G5:1 | B5:2 A5:1 | '
             'C6:2 B5:1 | A5:3 | C6:1 A5:1 E5:1 | G5:1 E5:1 B4:1 | A4:1 D#5:1 F#5:1 | E5:3')
_STEPPE_A_CH = 'Em Em Am Am D G C B7 Em Em Am Am Am Em B7 Em'
_STEPPE_B = ('D5:1 G5:1 B5:1 | B5:2 A5:1 | A5:1 F#5:1 D5:1 | F#5:3 | E5:1 G5:1 C6:1 | '
             'B5:2 G5:1 | A5:1 C6:1 B5:1 | A5:3 | D5:1 G5:1 B5:1 | B5:2 G5:1 | C6:2 A5:1 | '
             'F#5:3 | E5:1 G5:1 E5:1 | D5:2 B4:1 | D#5:1 F#5:1 A5:1 | B5:3')
STEPPE = dict(
    title='Step (Steppe)', slug='03_step', tempo=126, bpb=3, rt60=3.0, wet=0.5, seed=33,
    sections=[
        dict(name='intro', accomp='waltz', dyn=0.8, chords='Em Em Am B7',
             melody='r:3 | r:3 | r:3 | r:3',
             reg=dict(melody='flute_trem', harmony='celeste', pedal='pedal_soft')),
        dict(name='A', accomp='waltz', chords=_STEPPE_A_CH, melody=_STEPPE_A,
             reg=dict(melody='flute_trem', harmony='celeste', pedal='pedal_soft')),
        dict(name='B', accomp='waltz', chords='G G D D C G Am D G Em Am D C G B7 B7',
             melody=_STEPPE_B, reg=dict(melody='oboe', harmony='celeste', pedal='pedal_soft')),
        dict(name="A'", accomp='waltz', dyn=1.1, chords=_STEPPE_A_CH, melody=_STEPPE_A,
             reg=dict(melody='principal8_4', harmony='flute8_4', pedal='pedal')),
        dict(name='outro', accomp='chorale', dyn=0.85, rit=True, chords='Am Em B7 Em Em',
             melody='C5:3 | B4:3 | D#5:3 | E5:3 | ~:3',
             reg=dict(melody='flute_trem', harmony='celeste', pedal='pedal_soft')),
    ])

SONGS = [BELLS, MARCH, STEPPE]
