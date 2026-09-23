"""Set volume + pan for the WARDOGS Irish template via the ClaudeBridge mixer CCs (by track index).

A session-style stereo image: melody leads up front and near-centre, the two strummers and the two
bellows pushed to opposite sides so they don't mask each other, rhythm centred, drums pulled back.

    python apply_mix.py
"""
import time

import mido

import wardogs_remote as remote

# track name (Cubase mixer order) -> (pan 0=L..64=C..127=R, volume CC 100=0dB, 64=-8dB)
MIX = [
    ('Bouzouki',          46,  90),
    ('Button Accordion',  92,  82),
    ('Concertina',        36,  82),
    ('Fiddle',            54,  98),
    ('Irish Flute',       78,  92),
    ('Irish Harp',       102,  84),
    ('Mandolin',          86,  86),
    ('Tenor Banjo',       44,  86),
    ('Tin Whistle',       64, 100),
    ('Bodhran',           64,  87),
    ('Uilleann Pipes',    60,  95),
]

port = mido.open_output(next(n for n in mido.get_output_names() if n.startswith(remote.PORT_PREFIX)))
for i, (name, pan, vol) in enumerate(MIX, 1):
    port.send(mido.Message('control_change', channel=i - 1, control=remote.CC_PAN, value=pan))
    port.send(mido.Message('control_change', channel=i - 1, control=remote.CC_VOLUME, value=vol))
    time.sleep(0.04)
    print(f'{i:2} {name:17} pan {pan:3}  vol {vol:3}')
print('mix applied')
