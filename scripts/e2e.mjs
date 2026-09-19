/*
  End-to-end check without the stick: open the app in headless Chrome, let it
  write its first table, then parse E:/hotas_curves.txt with a line-for-line
  port of the .tmc's NextInt()/Poll(), and compare with the app's own maths.
  Also changes a slider and checks the file follows. Screenshot to shot.png.
  Needs `npm run dev` running. Run: node scripts/e2e.mjs
*/
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP = process.env.APP ?? "http://localhost:5179/";
const TABLE = (process.env.SOLR_DIR ?? "E:/") + "hotas_curves.txt";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9450 + Math.floor(Math.random() * 260);
const chrome = spawn(CHROME, ["--headless=new", "--no-first-run",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "e2e-"))}`, `--remote-debugging-port=${port}`, "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let v;
for (let i = 0; i < 120 && !v; i++) {
  try { v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); }
}
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const ev = async (expression) => (await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await S("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await S("Page.navigate", { url: APP });
await sleep(2500);
// whatever earlier tests left behind, start from the built-in default preset
await ev(`document.querySelector(".presets-btn").click()`);
await sleep(150);
await ev(`[...document.querySelectorAll(".preset")].find(p => p.textContent.startsWith("Default (tuned)")).querySelector("button").click()`);
await sleep(1000);

// ---- the .tmc parser, ported literally
function poll(text) {
  let pos = 0;
  const fgetc = () => (pos < text.length ? text.charCodeAt(pos++) : -1);
  let rv = 0;
  const next = () => {
    let c = fgetc();
    while (c !== -1 && c !== 45 && (c < 48 || c > 57)) c = fgetc();
    if (c === -1) return 0;
    let neg = 0;
    if (c === 45) { neg = 1; c = fgetc(); }
    rv = 0;
    while (c >= 48 && c <= 57) { rv = rv * 10 + c - 48; c = fgetc(); }
    if (neg) rv = -rv;
    return 1;
  };
  if (!next()) return null;
  const g = rv; const t = [];
  while (t.length < 771 && next()) t.push(rv);
  if (t.length !== 771 || !next() || rv !== g) return null;
  return { gen: g, t };
}
// Shape() from the .tmc
const shape = (t, a, raw) => {
  const p = (raw + 32767) * 128 / 32767;
  let i = Math.trunc(p); i = Math.max(0, Math.min(255, i));
  const f = p - i; const b = a * 257 + i;
  return t[b] + (t[b + 1] - t[b]) * f;
};

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fails++; };

const first = poll(readFileSync(TABLE, "latin1"));
ok(first, `table file parses the way the script parses it (gen ${first?.gen})`);
ok(Math.abs(shape(first.t, 0, 0)) < 1, "roll: stick centre -> 0");
ok(Math.abs(shape(first.t, 0, 32767 * 0.01)) < 1, "roll: 1% stick is inside the 2% deadzone -> 0");
ok(Math.abs(shape(first.t, 0, 32767) - 32767) <= 1, "roll: full stick -> full output");
ok(Math.abs(shape(first.t, 0, -32767) + 32767) <= 1, "roll: full negative -> full negative");
const half = shape(first.t, 0, 32767 / 2) / 32767;
ok(half > 0.2 && half < 0.45, `roll: 50% stick -> ${(half * 100).toFixed(1)}% (softer than linear)`);

// ---- move the curve slider and check the file follows
await ev(`(() => {
  const r = [...document.querySelectorAll('.field')].find(f => f.textContent.startsWith('Curve')).querySelector('input[type=range]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(r, '6'); r.dispatchEvent(new Event('input', { bubbles: true }));
  r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
})()`);
await sleep(1200);
const second = poll(readFileSync(TABLE, "latin1"));
ok(second && second.gen !== first.gen, `slider change rewrote the table (gen ${first.gen} -> ${second?.gen})`);
const half2 = shape(second.t, 0, 32767 / 2) / 32767;
// the log line, read the way the script's ReadNote() reads it
const txt = readFileSync(TABLE, "latin1");
const note = txt.slice(txt.indexOf("#", txt.lastIndexOf(String(second.gen))) + 1).split(/[\r\n]/)[0];
console.log(`      console line: ${note}  |  #${second.gen}`);
ok(/^\d\d [A-Z][a-z]{2} \d{4}  \d\d:\d\d:\d\d  \|  Roll: curve 2 -> 6$/.test(note), "log line has date, time and what changed");
ok(half2 < half, `curve 6 is softer at 50%: ${(half2 * 100).toFixed(1)}% < ${(half * 100).toFixed(1)}%`);
ok(Math.abs(shape(second.t, 1, 32767 / 2) / 32767 - half) < 1e-6, "pitch untouched by a roll edit");

// ---- copy roll's curve onto both other axes; invert must stay per axis
await ev(`[...document.querySelectorAll('.copy button')].find(b => b.textContent === 'Both').click()`);
await sleep(1000);
const third = poll(readFileSync(TABLE, "latin1"));
const same = (a1, a2) => [0, 64, 128, 160, 200, 256].every((i) => third.t[a1 * 257 + i] === third.t[a2 * 257 + i]);
ok(third.gen !== second.gen && same(0, 1) && same(0, 2), "Copy to Both: pitch and yaw tables now equal roll's");
await ev(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))`);
await sleep(1000);
const fourth = poll(readFileSync(TABLE, "latin1"));
ok(Math.abs(shape(fourth.t, 2, 32767 / 2) - shape(first.t, 2, 32767 / 2)) < 1, "Ctrl+Z undoes the copy in one step");

// ---- split sides: only the left side gets a 20% deadzone
await ev(`[...document.querySelectorAll('.sides button')].find(b => b.textContent.includes('Left')).click()`);
await sleep(150);
await ev(`(() => {
  const r = [...document.querySelectorAll('.field')].find(f => f.textContent.startsWith('Centre deadzone')).querySelector('input[type=range]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(r, '20'); r.dispatchEvent(new Event('input', { bubbles: true }));
  r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
})()`);
await sleep(1000);
const sp = poll(readFileSync(TABLE, "latin1"));
const L = shape(sp.t, 0, -32767 * 0.15), Rt = shape(sp.t, 0, 32767 * 0.15);
ok(Math.abs(L) < 1 && Rt > 100, `split: left 15% stick -> ${(L / 327.67).toFixed(1)}% (inside its 20% deadzone), right 15% -> ${(Rt / 327.67).toFixed(1)}%`);
ok(/split/.test(await ev(`document.querySelector('.tabs button.on small').textContent`)), "roll tab shows it is split");
await ev(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))`);
await ev(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))`);
await sleep(800);

const badge = await ev(`document.querySelector('.sync').textContent`);
console.log(`badge: "${badge}"`);

// restore the default so the real script starts from the tuned profile
await ev(`(() => {
  const r = [...document.querySelectorAll('.field')].find(f => f.textContent.startsWith('Curve')).querySelector('input[type=range]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(r, '2'); r.dispatchEvent(new Event('input', { bubbles: true }));
  r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
})()`);
await sleep(1000);
const shot = await S("Page.captureScreenshot", { format: "png" });
writeFileSync(new URL("../shot.png", import.meta.url), Buffer.from(shot.result.data, "base64"));

chrome.kill();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
