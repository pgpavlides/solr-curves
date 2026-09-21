/*
  Curve maths. Everything the stick does is decided here; the T.A.R.G.E.T.
  script only interpolates the table this produces.

  Units: stick and output are both -1..1 in code, percent in the UI.
  Deadzone and saturation are percent of HALF travel (centre to one end),
  which is what T.A.R.G.E.T.'s own "center" means, so 2 here is exactly the
  CYC_CENTRE 2 of the old script.
*/

export type Mode = "scurve" | "shape" | "points";

/*
  Shape families (mode "shape"). Each maps t 0..1 (stick past the deadzone,
  up to the saturation point) to 0..1, bent by one strength 0..100:

    expo       RC-style expo: (1-k)t + k t^3              calmer centre
    power      t^(1 + 4k)  (k=25 -> t^2, k=50 -> t^3)      very soft centre, steep end
    sine       (1-k)t + k(1 - cos(t pi/2))                 soft centre, near-linear finish
    smooth     (1-k)t + k(3t^2 - 2t^3)  (smoothstep)       soft at centre AND at the stop
    faststart  ln(1 + a t) / ln(1 + a), a grows with k     quick off centre, calm at the stop
    dualrate   straight to (50%, k%) then straight to 100% two rates with a knee
*/
export type ShapeKind = "expo" | "power" | "sine" | "smooth" | "faststart" | "dualrate";

export const SHAPES: { kind: ShapeKind; label: string; strength: string }[] = [
  { kind: "expo", label: "Expo", strength: "Expo %: 0 linear, 100 pure cubic" },
  { kind: "power", label: "Power", strength: "Exponent: 0 = x¹, 25 = x², 50 = x³, 100 = x⁵" },
  { kind: "sine", label: "Sine", strength: "How much sine ease is blended in" },
  { kind: "smooth", label: "Smooth S", strength: "How much smoothstep is blended in" },
  { kind: "faststart", label: "Fast start", strength: "How quick off centre (log curve)" },
  { kind: "dualrate", label: "Dual rate", strength: "Output % at half stick (the knee)" },
];

export function shapeFn(kind: ShapeKind, strength: number): (t: number) => number {
  const k = clamp(strength, 0, 100) / 100;
  switch (kind) {
    case "expo":
      return (t) => (1 - k) * t + k * t * t * t;
    case "power": {
      const p = 1 + 4 * k;
      return (t) => Math.pow(t, p);
    }
    case "sine":
      return (t) => (1 - k) * t + k * (1 - Math.cos((t * Math.PI) / 2));
    case "smooth":
      return (t) => (1 - k) * t + k * (3 * t * t - 2 * t * t * t);
    case "faststart": {
      if (k < 0.005) return (t) => t;
      const a = Math.pow(200, k) - 1; // 0 -> linear, 100 -> ln(1+199t)/ln(200)
      return (t) => Math.log(1 + a * t) / Math.log(1 + a);
    }
    case "dualrate": {
      const h = clamp(k, 0.02, 0.98);
      return (t) => (t <= 0.5 ? (t / 0.5) * h : h + ((t - 0.5) / 0.5) * (1 - h));
    }
  }
}

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
  // shape families (mode "shape"); deadzone, saturation and outMax apply too
  shape?: ShapeKind;
  strength?: number;  // 0..100, meaning per family (see SHAPES)
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

/** The order is the table order in hotas_curves.txt - the script reads it so. */
export const AXES = ["roll", "pitch", "yaw", "throttle"] as const;
export type AxisName = (typeof AXES)[number];

export const AXIS_LABEL: Record<AxisName, string> = {
  roll: "Roll",
  pitch: "Pitch",
  yaw: "Yaw (twist)",
  throttle: "Throttle",
};

/** Axes read from the Sol-R 6 Throttle rather than the stick. */
export const ON_THROTTLE: Record<AxisName, boolean> = { roll: false, pitch: false, yaw: false, throttle: true };

/** What each side of each control is, in the hand. DirectInput: forward = −. */
export const SIDE_LABEL: Record<AxisName, Record<SideName, string>> = {
  roll: { neg: "Left", pos: "Right" },
  pitch: { neg: "Forward", pos: "Back" },
  yaw: { neg: "Twist left", pos: "Twist right" },
  throttle: { neg: "Lower half", pos: "Upper half" },
};

export const NSAMP = 257;
export const AMAX = 32767;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clone = <T,>(v: T): T => structuredClone(v);

/** The default everyone starts from: the tuned profile that already works. */
export function defaultSide(name: AxisName): Side {
  // the throttle starts straight: no deadzone in the middle of its travel
  const lever = name === "throttle";
  return {
    mode: "scurve",
    deadzone: lever ? 0 : name === "yaw" ? 3 : 2,
    curve: lever ? 0 : 2,
    saturation: 0,
    outMax: 100,
    points: [[0, 0], [25, 15], [50, 38], [75, 67], [100, 100]],
    smooth: true,
    shape: "expo",
    strength: 40,
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
  if (s.mode === "shape") {
    const g = shapeFn(s.shape ?? "expo", s.strength ?? 40);
    const dz = s.deadzone / 100;
    const M = 1 - s.saturation / 100;
    const k = s.outMax / 100;
    return (ax) => {
      if (ax <= dz) return 0;
      if (ax >= M || M <= dz) return k;
      return k * clamp(g((ax - dz) / (M - dz)), 0, 1);
    };
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
  // the side's own curve: its S-curve, or its shape (a points side is
  // re-sampled from its S-curve settings, as before)
  const f = sideEvaluator(s.mode === "shape" ? s : { ...s, mode: "scurve" });
  const dz = s.deadzone;
  const xs = [0, dz, ...[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((q) => dz + (100 - dz) * q), 100];
  const uniq = [...new Set(xs.map((x) => Math.round(x * 10) / 10))];
  return uniq.map((x) => [x, Math.round(f(x / 100) * 1000) / 10] as Pt);
}
