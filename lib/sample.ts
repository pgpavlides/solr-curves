import type { Key, Maneuver } from "@/data/maneuvers";

const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export interface Sampled {
  pos: [number, number, number];
  hdg: number;
  pitch: number;
  roll: number;
  coll: number;
  cyc: [number, number];
  ped: number;
  ias: number;
  /** index into maneuver.phases */
  phase: number;
}

/**
 * Sample a maneuver at normalised time t (0..1).
 *
 * Smoothstep between keys rather than a spline: control inputs must not
 * overshoot their authored values, because the gauges are the teaching
 * surface and an overshoot would show a stick position the pilot never used.
 */
export function sample(m: Maneuver, t: number): Sampled {
  const keys = m.keys;
  const u = Math.min(Math.max(t, 0), 1);

  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= u) i++;
  const a: Key = keys[i];
  const b: Key = keys[Math.min(i + 1, keys.length - 1)];
  const span = b.t - a.t;
  const k = span <= 0 ? 0 : smooth((u - a.t) / span);

  let phase = 0;
  for (let j = 0; j < m.phases.length; j++) if (u >= m.phases[j].at) phase = j;

  return {
    pos: [
      lerp(a.p[0], b.p[0], k),
      lerp(a.p[1], b.p[1], k),
      lerp(a.p[2], b.p[2], k),
    ],
    hdg: lerp(a.hdg, b.hdg, k),
    pitch: lerp(a.pitch, b.pitch, k),
    roll: lerp(a.roll, b.roll, k),
    coll: lerp(a.coll, b.coll, k),
    cyc: [lerp(a.cyc[0], b.cyc[0], k), lerp(a.cyc[1], b.cyc[1], k)],
    ped: lerp(a.ped, b.ped, k),
    ias: lerp(a.ias, b.ias, k),
    phase,
  };
}

/** Dense polyline of the whole track, for drawing the path. */
export function trackPoints(m: Maneuver, steps = 240): Float32Array {
  const out = new Float32Array((steps + 1) * 3);
  for (let i = 0; i <= steps; i++) {
    const s = sample(m, i / steps);
    out[i * 3] = s.pos[0];
    out[i * 3 + 1] = s.pos[1];
    out[i * 3 + 2] = s.pos[2];
  }
  return out;
}
