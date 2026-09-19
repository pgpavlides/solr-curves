/*
  Curve maths. Everything the stick does is decided here; the T.A.R.G.E.T.
  script only interpolates the table this produces.

  Units: stick and output are both -1..1 in code, percent in the UI.
  Deadzone and saturation are percent of HALF travel (centre to one end),
  which is what T.A.R.G.E.T.'s own "center" means, so 2 here is exactly the
  CYC_CENTRE 2 of the old script.
*/

export type Mode = "scurve" | "points";

/** A control point in percent: x = stick, y = output. */
export type Pt = [number, number];

/*
  One side of the stick, centre to one end. Everything is a MAGNITUDE here:
  x 0..100 is how far the stick is from centre, y is how much output. The
  left/forward side stores its own Side in the same terms, and the maths
  applies it with the sign flipped - so a side never needs to know which way
  it points.
*/
export interface Side {
  mode: Mode;
  // S-curve, same maths as T.A.R.G.E.T.'s fcurve()
  deadzone: number;   // % of half travel with no output around centre
  curve: number;      // -20..20: positive = softer centre, negative = twitchier
  saturation: number; // % of half travel at the end that is already full output
  outMax: number;     // % output at full stick
  // custom points, x ascending from 0 to 100
  points: Pt[];
  smooth: boolean;    // monotone cubic through the points, else straight lines
}

export type SideName = "pos" | "neg";

export interface AxisCurve {
  /** true: both sides are the same curve (edits go to both) */
  linked: boolean;
  pos: Side;          // + side: right / back / twist right
  neg: Side;          // − side: left / forward / twist left
  invert: boolean;
}

export const AXES = ["roll", "pitch", "yaw"] as const;
export type AxisName = (typeof AXES)[number];

export const AXIS_LABEL: Record<AxisName, string> = {
  roll: "Roll",
  pitch: "Pitch",
  yaw: "Yaw (twist)",
};

/** What each side of each control is, in the hand. DirectInput: forward = −. */
export const SIDE_LABEL: Record<AxisName, Record<SideName, string>> = {
  roll: { neg: "Left", pos: "Right" },
  pitch: { neg: "Forward", pos: "Back" },
  yaw: { neg: "Twist left", pos: "Twist right" },
};

export const NSAMP = 257;
export const AMAX = 32767;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clone = <T,>(v: T): T => structuredClone(v);

/** The default everyone starts from: the tuned profile that already works. */
export function defaultSide(name: AxisName): Side {
  return {
    mode: "scurve",
    deadzone: name === "yaw" ? 3 : 2,
    curve: 2,
    saturation: 0,
    outMax: 100,
    points: [[0, 0], [25, 15], [50, 38], [75, 67], [100, 100]],
    smooth: true,
  };
}

export function defaultAxis(name: AxisName): AxisCurve {
  const s = defaultSide(name);
  return { linked: true, pos: s, neg: clone(s), invert: false };
}

/*
  Curves saved before the sides were split had one set of settings plus
  either magnitude points (symmetric) or points across -100..100. Convert
  them so nothing anyone tuned is lost.
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(old: any, name: AxisName): AxisCurve {
  if (!old || typeof old !== "object") return defaultAxis(name);
  if (old.pos && old.neg) return old as AxisCurve;
  const base: Side = {
    mode: old.mode ?? "scurve",
    deadzone: old.deadzone ?? 2,
    curve: old.curve ?? 2,
    saturation: old.saturation ?? 0,
    outMax: old.outMax ?? 100,
    points: old.points ?? defaultSide(name).points,
    smooth: old.smooth ?? true,
  };
  if (old.symmetric !== false) return { linked: true, pos: base, neg: clone(base), invert: !!old.invert };
  const pts: Pt[] = [...base.points].sort((a, b) => a[0] - b[0]);
  const half = (src: Pt[]): Pt[] => {
    const h = src.filter((p) => p[0] > 0);
    return [[0, 0], ...h];
  };
  const pos = half(pts);
  const neg = half(pts.map(([x, y]) => [-x, -y] as Pt).sort((a, b) => a[0] - b[0]));
  return {
    linked: false,
    pos: { ...base, points: pos.length > 1 ? pos : defaultSide(name).points },
    neg: { ...clone(base), points: neg.length > 1 ? neg : defaultSide(name).points },
    invert: !!old.invert,
  };
}

/** Positive half of fcurve() from target.tmh, 0..1 in, 0..1 out. */
function sHalf(ax: number, c: Side) {
  const dz = c.deadzone / 100;
  const M = 1 - c.saturation / 100;
  if (ax <= dz) return 0;
  if (ax >= M || M <= dz) return 1;
  if (Math.abs(c.curve) < 0.01) return (ax - dz) / (M - dz);
  return (Math.exp((ax - dz) * c.curve) - 1) / (Math.exp((M - dz) * c.curve) - 1);
}

/*
  Fritsch-Carlson monotone cubic. A plain spline overshoots between points
  that are close together, which on a flight axis means the output briefly
  goes BACKWARDS as the stick moves forwards. This one cannot.
*/
function monotone(xs: number[], ys: number[]) {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1e-9));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

function linear(xs: number[], ys: number[]) {
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    const n = xs.length;
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / (xs[i + 1] - xs[i] || 1e-9);
    return ys[i] + (ys[i + 1] - ys[i]) * t;
  };
}

/** One side: stick magnitude 0..1 -> output (normally 0..1). */
export function sideEvaluator(s: Side): (ax: number) => number {
  if (s.mode === "scurve") {
    const k = s.outMax / 100;
    return (ax) => k * sHalf(ax, s);
  }
  const pts = [...s.points].sort((a, b) => a[0] - b[0]);
  const xs = pts.map((p) => p[0] / 100);
  const ys = pts.map((p) => p[1] / 100);
  const f = s.smooth && pts.length > 2 ? monotone(xs, ys) : linear(xs, ys);
  return (ax) => clamp(f(ax), -1, 1);
}

/** The whole axis: stick -1..1 -> output -1..1. */
export function evaluator(c: AxisCurve): (x: number) => number {
  const sign = c.invert ? -1 : 1;
  const fp = sideEvaluator(c.pos);
  const fn = c.linked ? fp : sideEvaluator(c.neg);
  return (x) => sign * (x >= 0 ? fp(x) : -fn(-x));
}

/** 257 samples over stick -1..1, as the integers the script reads. */
export function table(c: AxisCurve): number[] {
  const f = evaluator(c);
  const out: number[] = [];
  for (let i = 0; i < NSAMP; i++) {
    const x = i / 128 - 1;
    out.push(Math.round(clamp(f(x), -1, 1) * AMAX));
  }
  return out;
}

/** Sample a side's S-curve into editable points, so a custom curve can start from it. */
export function scurveToPoints(s: Side): Pt[] {
  const f = sideEvaluator({ ...s, mode: "scurve" });
  const dz = s.deadzone;
  const xs = [0, dz, dz + (100 - dz) * 0.25, dz + (100 - dz) * 0.5, dz + (100 - dz) * 0.75, 100];
  const uniq = [...new Set(xs.map((x) => Math.round(x * 10) / 10))];
  return uniq.map((x) => [x, Math.round(f(x / 100) * 1000) / 10] as Pt);
}
