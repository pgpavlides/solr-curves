import type { Key, Maneuver } from "@/data/maneuvers";

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

/*
  Monotone cubic (Fritsch–Carlson / PCHIP) interpolation.

  The obvious approach — ease between each pair of keys — is wrong here.
  Smoothstep has zero derivative at both ends, so the aircraft decelerates to a
  standstill at every single keyframe and the maneuver reads as a series of
  steps rather than one movement.

  PCHIP gives a curve that is C1 continuous across the whole timeline: velocity
  flows through the keys instead of dying at them. It is chosen over a plain
  Catmull-Rom because it provably never overshoots the authored values, and the
  control channels are the teaching surface — a spline that overshot would show
  the gauges a stick position the pilot never used.
*/

const CHANNELS = 11; // x y z hdg pitch roll coll cycX cycY ped ias

function channelValues(keys: Key[]): Float64Array[] {
  const n = keys.length;
  const out: Float64Array[] = Array.from({ length: CHANNELS }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    out[0][i] = k.p[0];
    out[1][i] = k.p[1];
    out[2][i] = k.p[2];
    out[3][i] = k.hdg;
    out[4][i] = k.pitch;
    out[5][i] = k.roll;
    out[6][i] = k.coll;
    out[7][i] = k.cyc[0];
    out[8][i] = k.cyc[1];
    out[9][i] = k.ped;
    out[10][i] = k.ias;
  }
  return out;
}

/**
 * Fritsch–Carlson slopes for one channel.
 *
 * When `loop` is set the neighbour lookup wraps, so the tangent either side of
 * the seam matches and a looping maneuver does not jerk once per cycle. The
 * closing key is treated as a duplicate of the opening one, and the wrapped
 * neighbour is shifted by the difference between them — which is what makes a
 * heading authored 0 → 360 wrap correctly instead of unwinding backwards.
 */
function slopes(t: Float64Array, y: Float64Array, loop: boolean): Float64Array {
  const n = y.length;
  const d = new Float64Array(n);
  if (n < 2) return d;

  const h = new Float64Array(n - 1);
  const delta = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = t[i + 1] - t[i];
    delta[i] = h[i] > 0 ? (y[i + 1] - y[i]) / h[i] : 0;
  }

  const blend = (hPrev: number, hNext: number, dPrev: number, dNext: number) => {
    if (dPrev === 0 || dNext === 0 || dPrev * dNext < 0) return 0;
    const w1 = 2 * hNext + hPrev;
    const w2 = hNext + 2 * hPrev;
    return (w1 + w2) / (w1 / dPrev + w2 / dNext);
  };

  for (let i = 1; i < n - 1; i++) {
    d[i] = blend(h[i - 1], h[i], delta[i - 1], delta[i]);
  }

  if (loop && n > 2) {
    // Across the seam the last segment is the one preceding the first.
    const seam = blend(h[n - 2], h[0], delta[n - 2], delta[0]);
    d[0] = seam;
    d[n - 1] = seam;
  } else {
    // One-sided ends, clamped so the curve stays monotone near the edges.
    d[0] = endSlope(h[0], h[1] ?? h[0], delta[0], delta[1] ?? delta[0]);
    d[n - 1] = endSlope(
      h[n - 2],
      h[n - 3] ?? h[n - 2],
      delta[n - 2],
      delta[n - 3] ?? delta[n - 2]
    );
  }
  return d;
}

/**
 * Non-uniform Catmull-Rom tangents, used for the three position channels only.
 *
 * PCHIP is monotone, which means it forces the derivative to zero at every
 * local extremum. On a control channel that is exactly what we want. On a
 * flight path it is a defect: at the apex of a turn the aircraft is moving
 * purely along one axis, so the other axis has an extremum there, and zeroing
 * its derivative flattens the track — the aircraft visibly straightens out
 * mid-turn. Catmull-Rom keeps the tangent alive through the extremum.
 */
function catmullSlopes(t: Float64Array, y: Float64Array, loop: boolean): Float64Array {
  const n = y.length;
  const d = new Float64Array(n);
  if (n < 2) return d;
  for (let i = 1; i < n - 1; i++) {
    d[i] = (y[i + 1] - y[i - 1]) / (t[i + 1] - t[i - 1]);
  }
  if (loop && n > 2) {
    // The closing key repeats the opening one, so the wrapped neighbour is the
    // second-to-last, shifted by however far the channel travels over a lap.
    const lap = y[n - 1] - y[0];
    const span = t[n - 1] - t[n - 2] + (t[1] - t[0]);
    const seam = (y[1] - (y[n - 2] - lap)) / span;
    d[0] = seam;
    d[n - 1] = seam;
  } else {
    d[0] = (y[1] - y[0]) / (t[1] - t[0]);
    d[n - 1] = (y[n - 1] - y[n - 2]) / (t[n - 1] - t[n - 2]);
  }
  return d;
}

function endSlope(h0: number, h1: number, d0: number, d1: number): number {
  let m = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (m * d0 <= 0) m = 0;
  else if (d0 * d1 <= 0 && Math.abs(m) > Math.abs(3 * d0)) m = 3 * d0;
  return m;
}

interface Curve {
  t: Float64Array;
  y: Float64Array[];
  d: Float64Array[];
}

const cache = new WeakMap<Maneuver, Curve>();

function curveFor(m: Maneuver): Curve {
  const hit = cache.get(m);
  if (hit) return hit;

  const keys = m.keys;
  const t = new Float64Array(keys.length);
  for (let i = 0; i < keys.length; i++) t[i] = keys[i].t;

  const y = channelValues(keys);
  // Channels 0-2 are position (Catmull-Rom, smooth through extrema);
  // 3 and up are attitude and control inputs (PCHIP, never overshoots).
  const d = y.map((ch, i) =>
    i < 3 ? catmullSlopes(t, ch, m.loops) : slopes(t, ch, m.loops)
  );
  const built: Curve = { t, y, d };
  cache.set(m, built);
  return built;
}

/** Sample a maneuver at normalised time t (0..1). */
export function sample(m: Maneuver, tRaw: number): Sampled {
  const u = Math.min(Math.max(tRaw, 0), 1);
  const { t, y, d } = curveFor(m);
  const n = t.length;

  let i = 0;
  while (i < n - 2 && t[i + 1] <= u) i++;

  const h = t[i + 1] - t[i];
  const s = h > 0 ? (u - t[i]) / h : 0;
  const s2 = s * s;
  const s3 = s2 * s;

  // Cubic Hermite basis
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  const v = (c: number) =>
    h00 * y[c][i] + h10 * h * d[c][i] + h01 * y[c][i + 1] + h11 * h * d[c][i + 1];

  let phase = 0;
  for (let j = 0; j < m.phases.length; j++) if (u >= m.phases[j].at) phase = j;

  return {
    pos: [v(0), Math.max(v(1), 0), v(2)],
    hdg: v(3),
    pitch: v(4),
    roll: v(5),
    coll: v(6),
    cyc: [v(7), v(8)],
    ped: v(9),
    ias: v(10),
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
