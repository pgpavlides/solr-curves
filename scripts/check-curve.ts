/*
  Proves the app's S-curve is T.A.R.G.E.T.'s S-curve, sample for sample:
  the default table must match fcurve() from target.tmh, which is also what
  the script uses for its built-in default. Run: npm run check
*/
import { table, defaultAxis, evaluator } from "../src/curve.ts";

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

const p = evaluator({ ...defaultAxis("roll"), mode: "points" });
const odd = [0.1, 0.33, 0.5, 0.9].every((x) => Math.abs(p(x) + p(-x)) < 1e-9);
let mono = true;
for (let i = -100; i < 100; i++) if (p((i + 1) / 100) < p(i / 100) - 1e-12) mono = false;
console.log(`points: symmetric ${odd}, never goes backwards ${mono}`);
if (worst > 1 || !odd || !mono) process.exit(1);
