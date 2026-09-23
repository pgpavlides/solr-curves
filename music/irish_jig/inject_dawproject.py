"""Put the current make_jig.py parts onto the matching tracks of a Cubase DAWproject export.

Clips that came from an earlier jig.mid (note clips using only the jig's MIDI channels) are removed
wherever they ended up, and one clip per jig part is added to the track with the same name.
Everything else in the export (mixer, EQ, Kontakt states, other clips) is copied unchanged.

    python inject_dawproject.py song1.dawproject song1_fixed.dawproject

Notes only for now: the CC1 swells in jig.mid are not written into the DAWproject clips.
"""
import sys
import xml.etree.ElementTree as ET
import zipfile

import make_jig as jig

SEC_PER_TICK = 60 / (jig.BPM * jig.TPQ)
JIG_CHANNELS = {str(ch) for _, ch, span in jig.TRACKS if span}


def fmt(x):
    return repr(round(x, 9))


def is_old_jig_clip(clip):
    notes = clip.findall('Notes/Note')
    return bool(notes) and {n.get('channel') for n in notes} <= JIG_CHANNELS


def new_clip(name, ch, span, color):
    notes = jig.part_notes(name, span)
    t0 = span[0] * jig.BAR
    end = max(s + length for _, s, length, _, _ in notes)
    bars = -(-(end - t0) // jig.BAR)  # round up to whole bars
    clip = ET.Element('Clip', {'time': fmt(t0 * SEC_PER_TICK), 'duration': fmt(bars * jig.BAR * SEC_PER_TICK),
                               'name': name, 'enable': 'true', 'color': color})
    el = ET.SubElement(clip, 'Notes')
    for _, start, length, pitch, vel in sorted(notes, key=lambda n: (n[1], n[3])):
        ET.SubElement(el, 'Note', {'time': fmt((start - t0) * SEC_PER_TICK),
                                   'duration': fmt(length * SEC_PER_TICK), 'channel': str(ch),
                                   'key': str(pitch), 'vel': fmt(vel / 127), 'rel': fmt(64 / 127)})
    return clip, len(notes)


def main(src, dst):
    zin = zipfile.ZipFile(src)
    root = ET.fromstring(zin.read('project.xml'))
    tracks = {t.get('name'): t for t in root.iter('Track')}
    lanes = {l.get('track'): l for l in root.find('Arrangement').iter('Lanes') if l.get('track')}
    track_name = {t.get('id'): n for n, t in tracks.items()}

    for track_id, lane in lanes.items():
        for clips in lane.findall('Clips'):
            for clip in clips.findall('Clip'):
                if is_old_jig_clip(clip):
                    print(f"removed old clip {clip.get('name')!r} ({len(clip.findall('Notes/Note'))} notes) "
                          f"from track {track_name.get(track_id)!r}")
                    clips.remove(clip)

    for name, ch, span in jig.TRACKS:
        if span is None:
            continue
        track = tracks.get(name)
        if track is None:
            raise SystemExit(f'no track named {name!r} in {src}')
        lane = lanes[track.get('id')]
        clips = lane.find('Clips')
        if clips is None:
            clips = ET.SubElement(lane, 'Clips')
        clip, n = new_clip(name, ch, span, track.get('color', '#929395ff'))
        clips.append(clip)
        print(f'added {name!r}: {n} notes from bar {span[0] + 1}')

    xml = ET.tostring(root, encoding='UTF-8', xml_declaration=True)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = xml if info.filename == 'project.xml' else zin.read(info.filename)
            zout.writestr(info, data)
    print(f'wrote {dst}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
