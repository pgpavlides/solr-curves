/*
  Proves the app's S-curve is T.A.R.G.E.T.'s S-curve, sample for sample:
  the default table must match fcurve() from target.tmh, which is also what
  the script uses for its built-in default. Run: npm run check
*/
import { table, defaultAxis, evaluator, migrate } from "../src/curve.ts";

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
if (worst > 1 || !odd || !mono || !sideOk || !migOk) process.exit(1);
