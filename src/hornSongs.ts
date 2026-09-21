import type { HornNote, HornSong } from "./bridge";

/*
  Built-in horn songs: simple, well-known melodies, one line each, written
  out by hand - no MIDI file needed. A note is [MIDI key, length in beats of
  `beat` seconds]; key 0 is a rest. Each plays slightly detached (the horn
  needs a gap between honks to sound like separate notes).
*/

export interface BuiltinSong {
  name: string;
  from: string;
  /** seconds per unit of length */
  beat: number;
  notes: [number, number][];
}

// note numbers, so the melodies read like sheet music
const A3s = 58, B3 = 59, D4s = 63, E4 = 64, F4 = 65, F4s = 66, G4 = 67, G4s = 68, A4 = 69, A4s = 70, B4 = 71,
  C5 = 72, C5s = 73, D5 = 74;

export const HORN_SONGS: BuiltinSong[] = [
  {
    name: "Hedwig's Theme",
    from: "Harry Potter",
    // lengths in eighth notes (3/8 time); an eighth is 0.28 s
    beat: 0.28,
    notes: [
      // phrase 1
      [B3, 1], [E4, 1.5], [G4, 0.5], [F4s, 1], [E4, 2], [B4, 1], [A4, 3], [F4s, 3],
      [E4, 1.5], [G4, 0.5], [F4s, 1], [D4s, 2], [F4, 1], [B3, 5],
      // phrase 2
      [B3, 1], [E4, 1.5], [G4, 0.5], [F4s, 1], [E4, 2], [B4, 1], [D5, 2], [C5s, 1], [C5, 2], [G4s, 1],
      [C5, 1.5], [B4, 0.5], [A4s, 1], [A3s, 2], [G4, 1], [E4, 5],
    ],
  },
];

/** A built-in song as the page's song: one track, "Melody". */
export function builtinSong(s: BuiltinSong): HornSong {
  const notes: HornNote[] = [];
  let t = 0;
  for (const [key, len] of s.notes) {
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
