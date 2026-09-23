"""Send a ClaudeBridge command to the loopMIDI port, optionally N times (same protocol as server.py).

    .venv\\Scripts\\python.exe send_command.py export_dawproject
    .venv\\Scripts\\python.exe send_command.py select_previous_track 13   # repeat 13x
"""
import sys
import time

import mido

import wardogs_remote as remote

name = sys.argv[1]
count = int(sys.argv[2]) if len(sys.argv) > 2 else 1
cc = remote.command_cc(name)
ch = remote.COMMAND_CHANNEL
port_name = next(n for n in mido.get_output_names() if n.startswith(remote.PORT_PREFIX))
with mido.open_output(port_name) as port:
    for _ in range(count):
        port.send(mido.Message('control_change', channel=ch, control=cc, value=127))
        port.send(mido.Message('control_change', channel=ch, control=cc, value=0))
        if count > 1:
            time.sleep(0.06)
print(f'sent {name} x{count} (ch {ch + 1}, CC {cc}) on {port_name}')
