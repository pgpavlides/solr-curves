"""Render every song in songs.py to tracks/<slug>.wav, .mp3 and .mid.

    python music/render.py            # all songs
    python music/render.py 02_marsh   # one song
"""
import pathlib
import subprocess
import sys

from organ import render
from songs import SONGS

OUT = pathlib.Path(__file__).parent / 'tracks'


def main(only):
    OUT.mkdir(exist_ok=True)
    for song in SONGS:
        if only and song['slug'] not in only:
            continue
        wav, mp3, mid = (OUT / f"{song['slug']}.{ext}" for ext in ('wav', 'mp3', 'mid'))
        seconds = render(song, wav, mid)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-b:a', '320k',
                        '-metadata', f"title={song['title']}", '-metadata', 'artist=WARDOGS',
                        str(mp3)], check=True)
        print(f"{song['slug']}: {int(seconds // 60)}:{seconds % 60:04.1f}")


if __name__ == '__main__':
    main(sys.argv[1:])
