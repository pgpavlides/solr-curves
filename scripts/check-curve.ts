/*
  Proves the app's S-curve is T.A.R.G.E.T.'s S-curve, sample for sample:
  the default table must match fcurve() from target.tmh, which is also what
  the script uses for its built-in default. Run: npm run check
*/
import { table, defaultAxis, evaluator, migrate, shapeFn, SHAPES, sideEvaluator } from "../src/curve.ts";

// fcurve() from target.tmh with lower = upper = trim = 0
function fcurve(x: number, center: number, curve: number) {
  const m = -1, M = 1, cM = center, cm = -cM;
  if (x < m) return -1;
  if (x < cm) return (1 - Math.exp((cm - x) * curve)) / (Math.exp((cm - m) * curve) - 1);
  if (x < cM) return 0;
  if (x < M) return (Math.exp((x - cM) * curve) - 1) / (Math.exp((M - cM) * curve) - 1);
  return 1;
}

let worst = 0;
for (const [name, dz] of [["roll", 0.02], ["yaw", 0.03]] as const) {
  const t = table(defaultAxis(name));
  for (let i = 0; i < 257; i++) {
    const x = i / 128 - 1;
    worst = Math.max(worst, Math.abs(t[i] - 32767 * fcurve(x, dz, 2)));
  }
}
console.log(`max difference from T.A.R.G.E.T. fcurve: ${worst.toFixed(2)} of 32767`);

const pts = { ...defaultAxis("roll").pos, mode: "points" as const };
const p = evaluator({ ...defaultAxis("roll"), pos: pts, neg: pts });
const odd = [0.1, 0.33, 0.5, 0.9].every((x) => Math.abs(p(x) + p(-x)) < 1e-9);
let mono = true;
for (let i = -100; i < 100; i++) if (p((i + 1) / 100) < p(i / 100) - 1e-12) mono = false;
console.log(`points: symmetric ${odd}, never goes backwards ${mono}`);
// split sides: the − side follows its own curve, the + side is untouched
const split = evaluator({ ...defaultAxis("roll"), linked: false, neg: { ...defaultAxis("roll").neg, deadzone: 20 } });
const lin = evaluator(defaultAxis("roll"));
const sideOk = split(-0.15) === 0 && lin(-0.15) !== 0 && split(0.15) === lin(0.15) && split(-1) === -1;
console.log(`split sides: − side has its own deadzone, + side unchanged ${sideOk}`);
// old saved curves still load
const oldAsym = migrate({ mode: "points", symmetric: false, smooth: false, deadzone: 2, curve: 2, saturation: 0, outMax: 100,
  points: [[-100, -80], [-50, -20], [0, 0], [50, 30], [100, 100]] }, "roll");
const m = evaluator(oldAsym);
const migOk = !oldAsym.linked && Math.abs(m(-0.5) + 0.2) < 1e-9 && Math.abs(m(0.5) - 0.3) < 1e-9 && Math.abs(m(-1) + 0.8) < 1e-9;
console.log(`old asymmetric curve migrates exactly ${migOk}`);
// shape families: 0 at centre, 1 at the stop, never backwards, at every strength
let shapesOk = true;
for (const { kind } of SHAPES) {
  for (const k of [0, 10, 25, 50, 75, 100]) {
    const g = shapeFn(kind, k);
    let prev = -1;
    for (let i = 0; i <= 400; i++) {
      const y = g(i / 400);
      if (y < prev - 1e-12 || !Number.isFinite(y)) { shapesOk = false; console.log(`  ${kind} ${k}: goes backwards at ${i / 4}%`); break; }
      prev = y;
    }
    if (Math.abs(g(0)) > 1e-9 || Math.abs(g(1) - 1) > 1e-9) { shapesOk = false; console.log(`  ${kind} ${k}: ends ${g(0)} .. ${g(1)}`); }
  }
}
// deadzone / saturation / max output apply to shapes like to S-curves
const ex = sideEvaluator({ ...defaultAxis("roll").pos, mode: "shape", shape: "expo", strength: 50, deadzone: 10, saturation: 10, outMax: 80 });
const wrapOk = ex(0.05) === 0 && Math.abs(ex(0.95) - 0.8) < 1e-9 && ex(0.5) > 0 && ex(0.5) < 0.4;
console.log(`shape families (${SHAPES.map((s) => s.kind).join(", ")}): 0..1, never backwards ${shapesOk}; deadzone/saturation/max apply ${wrapOk}`);
if (worst > 1 || !odd || !mono || !sideOk || !migOk || !shapesOk || !wrapOk) process.exit(1);
