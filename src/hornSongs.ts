import type { HornNote, HornSong } from "./bridge";

/*
  Built-in horn songs: short, well-known hooks, one line each, written out by
  hand - no MIDI file needed.

  A tune is a string of notes, `NAME/LENGTH`: "E5/1 D#5/1 -/2" is E5 for one
  unit, D#5 for one, then a rest for two. `beat` is the seconds per unit. Keys
  sit near the horn's own pitch (about E4) where they can, so nothing ends up
  sounding like a chipmunk. Each note plays slightly detached - the horn needs
  a gap between honks to sound like separate notes.
*/

export interface BuiltinSong {
  name: string;
  from: string;
  /** seconds per length unit */
  beat: number;
  tune: string;
}

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4" -> 61, "Bb3" -> 58 */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  return (Number(m[3]) + 1) * 12 + STEPS[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

/** A tune string as [key, length] pairs; key 0 is a rest. */
export function parseTune(tune: string): [number, number][] {
  return tune.trim().split(/\s+/).map((tok) => {
    const [n, len] = tok.split("/");
    const l = Number(len);
    if (!(l > 0)) throw new Error(`no length: ${tok}`);
    return [n === "-" ? 0 : midiOf(n), l];
  });
}

export const HORN_SONGS: BuiltinSong[] = [
  {
    name: "Hedwig's Theme", from: "Harry Potter", beat: 0.28, // eighths, 3/8
    tune: `B3/1 E4/1.5 G4/0.5 F#4/1 E4/2 B4/1 A4/3 F#4/3 E4/1.5 G4/0.5 F#4/1 D#4/2 F4/1 B3/5
      B3/1 E4/1.5 G4/0.5 F#4/1 E4/2 B4/1 D5/2 C#5/1 C5/2 G#4/1 C5/1.5 B4/0.5 A#4/1 A#3/2 G4/1 E4/5`,
  },
  {
    name: "Nokia ringtone", from: "Nokia (Gran Vals)", beat: 0.14, // eighths
    tune: "E5/1 D5/1 F#4/2 G#4/2 C#5/1 B4/1 D4/2 E4/2 B4/1 A4/1 C#4/2 E4/2 A4/6",
  },
  {
    name: "Never Gonna Give You Up", from: "Rick Astley", beat: 0.13, // sixteenths
    tune: `C4/1 D4/1 F4/1 D4/1 A4/3 A4/3 G4/6
      C4/1 D4/1 F4/1 D4/1 G4/3 G4/3 F4/3 E4/1 D4/2
      C4/1 D4/1 F4/1 D4/1 F4/4 G4/2 E4/3 D4/1 C4/4 C4/2 G4/4 F4/8`,
  },
  {
    name: "Super Mario Bros.", from: "Nintendo", beat: 0.15, // eighths
    tune: `E4/1 E4/1 -/1 E4/1 -/1 C4/1 E4/2 G4/2 -/2 G3/2 -/2
      C4/3 G3/3 E3/3 A3/2 B3/2 A#3/1 A3/2 G3/1.33 E4/1.33 G4/1.34 A4/2 F4/1 G4/2 E4/2 C4/1 D4/1 B3/3`,
  },
  {
    name: "Tetris", from: "Korobeiniki", beat: 0.17, // eighths
    tune: `E4/2 B3/1 C4/1 D4/2 C4/1 B3/1 A3/2 A3/1 C4/1 E4/2 D4/1 C4/1 B3/3 C4/1 D4/2 E4/2 C4/2 A3/2 A3/4
      -/1 D4/3 F4/1 A4/2 G4/1 F4/1 E4/3 C4/1 E4/2 D4/1 C4/1 B3/2 B3/1 C4/1 D4/2 E4/2 C4/2 A3/2 A3/4`,
  },
  {
    name: "Für Elise", from: "Beethoven", beat: 0.16, // sixteenths
    tune: `E5/1 D#5/1 E5/1 D#5/1 E5/1 B4/1 D5/1 C5/1 A4/2 -/1 C4/1 E4/1 A4/1 B4/2 -/1 E4/1 G#4/1 B4/1 C5/2 -/1
      E4/1 E5/1 D#5/1 E5/1 D#5/1 E5/1 B4/1 D5/1 C5/1 A4/3`,
  },
  {
    name: "Imperial March", from: "Star Wars", beat: 0.125, // sixteenths
    tune: "G4/4 G4/4 G4/4 Eb4/3 Bb4/1 G4/4 Eb4/3 Bb4/1 G4/8 D5/4 D5/4 D5/4 Eb5/3 Bb4/1 F#4/4 Eb4/3 Bb4/1 G4/8",
  },
  {
    name: "Star Wars Theme", from: "Star Wars", beat: 0.2, // triplet eighths
    tune: "A3/1 A3/1 A3/1 D4/6 A4/6 G4/1 F#4/1 E4/1 D5/6 A4/3 G4/1 F#4/1 E4/1 D5/6 A4/3 G4/1 F#4/1 G4/1 E4/6",
  },
  {
    name: "The Pink Panther", from: "Henry Mancini", beat: 0.2, // eighths
    tune: "D#4/1 E4/3 F#4/1 G4/3 D#4/1 E4/1 F#4/1 G4/1 C5/1 B4/1 E4/1 G4/1 B4/1 A#4/6 A4/1 G4/1 E4/1 D4/1 E4/6",
  },
  {
    name: "Mission: Impossible", from: "Lalo Schifrin", beat: 0.15, // eighths, 5/4
    tune: `G4/3 G4/3 Bb4/2 C5/2 G4/3 G4/3 F4/2 F#4/2
      G4/3 G4/3 Bb4/2 C5/2 G4/3 G4/3 F4/2 F#4/2
      Bb4/1 G4/1 D4/6 Bb4/1 G4/1 C#4/6 Bb4/1 G4/1 C4/6 Bb3/1 C4/1`,
  },
  {
    name: "Game of Thrones", from: "Ramin Djawadi", beat: 0.2, // eighths, 3/4
    tune: `G4/2 C4/2 D#4/1 F4/1 G4/2 C4/2 D#4/1 F4/1 G4/2 C4/2 E4/1 F4/1 G4/2 C4/2 E4/1 F4/1
      G4/6 C4/6 D#4/1 F4/1 G4/4 C4/4 D#4/1 F4/1 D4/8`,
  },
  {
    name: "He's a Pirate", from: "Pirates of the Caribbean", beat: 0.16, // eighths, 6/8
    tune: `A3/1 C4/1 D4/1 D4/1 -/1 D4/1 E4/1 F4/1 F4/1 -/1 F4/1 G4/1 E4/1 E4/1 -/1 D4/1 C4/1 C4/1 D4/2 -/1
      A3/1 C4/1 D4/1 D4/1 -/1 D4/1 E4/1 F4/1 F4/1 -/1 F4/1 G4/1 E4/1 E4/1 -/1 D4/1 C4/1 D4/3`,
  },
  {
    name: "Megalovania", from: "Undertale", beat: 0.11, // sixteenths
    tune: `D4/1 D4/1 D5/2 A4/3 G#4/2 G4/2 F4/2 D4/1 F4/1 G4/1
      C4/1 C4/1 D5/2 A4/3 G#4/2 G4/2 F4/2 D4/1 F4/1 G4/1
      B3/1 B3/1 D5/2 A4/3 G#4/2 G4/2 F4/2 D4/1 F4/1 G4/1
      A#3/1 A#3/1 D5/2 A4/3 G#4/2 G4/2 F4/2 D4/1 F4/1 G4/1`,
  },
  {
    name: "Axel F (Crazy Frog)", from: "Harold Faltermeyer", beat: 0.11, // sixteenths
    tune: `F4/4 G#4/3 F4/2 F4/1 A#4/2 F4/2 D#4/2 F4/4 C5/3 F4/2 F4/1 C#5/2 C5/2 G#4/2
      F4/2 C5/2 F5/2 F4/1 D#4/2 D#4/1 C4/2 G4/2 F4/6`,
  },
  {
    name: "Seven Nation Army", from: "The White Stripes", beat: 0.12, // sixteenths
    tune: "E4/6 E4/2 G4/3 E4/3 D4/2 C4/8 B3/8 E4/6 E4/2 G4/3 E4/3 D4/2 C4/8 B3/8",
  },
  {
    name: "Take On Me", from: "a-ha", beat: 0.14, // eighths
    tune: `F#4/1 F#4/1 D4/1 B3/1 -/1 B3/1 -/1 E4/1 -/1 E4/1 -/1 E4/1 G#4/1 G#4/1 A4/1 B4/1
      A4/1 A4/1 A4/1 E4/1 -/1 D4/1 -/1 F#4/1 -/1 F#4/1 -/1 F#4/1 E4/1 E4/1 F#4/1 E4/1`,
  },
  {
    name: "Sandstorm", from: "Darude", beat: 0.11, // sixteenths
    tune: `B3/1 B3/1 B3/1 B3/1 B3/2 B3/1 B3/1 B3/1 B3/1 B3/1 B3/1 B3/2
      E4/1 E4/1 E4/1 E4/1 E4/1 E4/1 E4/2 D4/1 D4/1 D4/1 D4/1 D4/1 D4/1 D4/2 A3/2
      B3/1 B3/1 B3/1 B3/1 B3/2 B3/1 B3/1 B3/1 B3/1 B3/1 B3/1 B3/2`,
  },
  {
    name: "Song of Storms", from: "Zelda: Ocarina of Time", beat: 0.18, // eighths
    tune: "D4/1 F4/1 D5/4 D4/1 F4/1 D5/4 E5/3 F5/1 E5/1 F5/1 E5/1 C5/1 A4/4 A4/2 D4/2 F4/1 G4/1 A4/6 A4/2 D4/2 F4/1 G4/1 E4/6",
  },
  {
    name: "Happy Birthday", from: "Traditional", beat: 0.45, // quarters
    tune: `G3/0.75 G3/0.25 A3/1 G3/1 C4/1 B3/2 G3/0.75 G3/0.25 A3/1 G3/1 D4/1 C4/2
      G3/0.75 G3/0.25 G4/1 E4/1 C4/1 B3/1 A3/2 F4/0.75 F4/0.25 E4/1 C4/1 D4/1 C4/2`,
  },
  {
    name: "Jingle Bells", from: "Traditional", beat: 0.35, // quarters
    tune: "E4/1 E4/1 E4/2 E4/1 E4/1 E4/2 E4/1 G4/1 C4/1.5 D4/0.5 E4/4 F4/1 F4/1 F4/1.5 F4/0.5 F4/1 E4/1 E4/1 E4/0.5 E4/0.5 E4/1 D4/1 D4/1 E4/1 D4/2 G4/2",
  },
  {
    name: "William Tell Overture", from: "Rossini", beat: 0.12, // sixteenths
    tune: "G4/1 G4/1 G4/2 G4/1 G4/1 G4/2 G4/1 G4/1 C5/2 D5/2 E5/4 G4/1 G4/1 G4/2 G4/1 G4/1 G4/2 G4/1 G4/1 C5/2 D5/2 E5/4",
  },
];

/** A built-in song as the page's song: one track, "Melody". */
export function builtinSong(s: BuiltinSong): HornSong {
  const notes: HornNote[] = [];
  let t = 0;
  for (const [key, len] of parseTune(s.tune)) {
    const secs = len * s.beat;
    if (key > 0) notes.push({ t, d: secs * 0.9, key, vel: 110, track: 0 });
    t += secs;
  }
  const keys = notes.map((n) => n.key);
  return {
    tracks: [{ index: 0, name: "Melody", notes: notes.length, low: Math.min(...keys), high: Math.max(...keys), drums: false }],
    notes,
    seconds: t,
  };
}
