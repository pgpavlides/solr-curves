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

export interface AxisCurve {
  mode: Mode;
  // S-curve, same maths as T.A.R.G.E.T.'s fcurve()
  deadzone: number;   // % of half travel with no output around centre
  curve: number;      // -20..20: positive = softer centre, negative = twitchier
  saturation: number; // % of half travel at each end that is already full output
  outMax: number;     // % output at full stick
  // custom points
  points: Pt[];       // ascending x. Symmetric: x 0..100. Otherwise -100..100
  symmetric: boolean;
  smooth: boolean;    // monotone cubic through the points, else straight lines
  // both
  invert: boolean;
}

export const AXES = ["roll", "pitch", "yaw"] as const;
export type AxisName = (typeof AXES)[number];

export const AXIS_LABEL: Record<AxisName, string> = {
  roll: "Roll",
  pitch: "Pitch",
  yaw: "Yaw (twist)",
};

export const NSAMP = 257;
export const AMAX = 32767;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The default everyone starts from: the tuned profile that already works. */
export function defaultAxis(name: AxisName): AxisCurve {
  const dz = name === "yaw" ? 3 : 2;
  return {
    mode: "scurve",
    deadzone: dz,
    curve: 2,
    saturation: 0,
    outMax: 100,
    points: [[0, 0], [25, 15], [50, 38], [75, 67], [100, 100]],
    symmetric: true,
    smooth: true,
    invert: false,
  };
}

/** Positive half of fcurve() from target.tmh, 0..1 in, 0..1 out. */
function sHalf(ax: number, c: AxisCurve) {
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

/** Build the evaluator for one axis: stick -1..1 -> output -1..1. */
export function evaluator(c: AxisCurve): (x: number) => number {
  const sign = c.invert ? -1 : 1;
  if (c.mode === "scurve") {
    const k = c.outMax / 100;
    return (x) => sign * Math.sign(x) * k * sHalf(Math.abs(x), c);
  }
  const pts = [...c.points].sort((a, b) => a[0] - b[0]);
  const xs = pts.map((p) => p[0] / 100);
  const ys = pts.map((p) => p[1] / 100);
  const f = c.smooth && pts.length > 2 ? monotone(xs, ys) : linear(xs, ys);
  if (c.symmetric) return (x) => sign * Math.sign(x) * clamp(f(Math.abs(x)), -1, 1);
  return (x) => sign * clamp(f(x), -1, 1);
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

/** Sample an S-curve into editable points, so a custom curve can start from it. */
export function scurveToPoints(c: AxisCurve): Pt[] {
  const f = evaluator({ ...c, mode: "scurve", invert: false });
  const dz = c.deadzone;
  const xs = [0, dz, dz + (100 - dz) * 0.25, dz + (100 - dz) * 0.5, dz + (100 - dz) * 0.75, 100];
  const uniq = [...new Set(xs.map((x) => Math.round(x * 10) / 10))];
  return uniq.map((x) => [x, Math.round(f(x / 100) * 1000) / 10] as Pt);
}

/** Mirror a symmetric point set to the full -100..100 range. */
export function mirrorPoints(pts: Pt[]): Pt[] {
  const pos = [...pts].sort((a, b) => a[0] - b[0]);
  const neg = pos.filter((p) => p[0] > 0).map(([x, y]) => [-x, -y] as Pt).reverse();
  return [...neg, ...pos];
}

/** Keep only the positive half of an asymmetric set. */
export function foldPoints(pts: Pt[]): Pt[] {
  const pos = pts.filter((p) => p[0] >= 0);
  if (!pos.length || pos[0][0] > 0) pos.unshift([0, 0]);
  return pos;
}
