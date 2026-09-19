/*
  Adds points with REAL mouse input (CDP Input.dispatchMouseEvent, the same
  path a physical mouse takes), not synthetic DOM events.
  Needs the test server on 5179. Run: node scripts/addpoint.mjs
*/
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9450 + Math.floor(Math.random() * 260);
const chrome = spawn(CHROME, ["--headless=new", "--no-first-run", `--user-data-dir=${mkdtempSync(join(tmpdir(), "ap-"))}`, `--remote-debugging-port=${port}`, "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let v; for (let i = 0; i < 120 && !v; i++) { try { v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const ev = async (e) => (await S("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await S("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await S("Page.navigate", { url: "http://localhost:5179/" }); await sleep(2500);
await ev(`[...document.querySelectorAll(".seg button")].find(b => b.textContent === "Points").click()`); await sleep(300);
const count = () => ev(`document.querySelectorAll(".pts tbody tr").length`);
const box = await ev(`(() => { const r = document.querySelector(".plot-bg").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const mouse = async (type, x, y, clickCount = 1) => S("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount, buttons: type === "mouseReleased" ? 0 : 1 });
const dbl = async (fx, fy) => {
  const x = box[0] + box[2] * fx, y = box[1] + box[3] * fy;
  await S("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await mouse("mousePressed", x, y, 1); await mouse("mouseReleased", x, y, 1);
  await mouse("mousePressed", x, y, 2); await mouse("mouseReleased", x, y, 2);
  await sleep(250);
};
const flash = () => ev(`document.querySelector(".copy-flash").textContent`);
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
// start from a known 6-point curve whatever the test folder holds
// start from a known 4-point curve: the built-in "Two-stage" style
await ev(`document.querySelector(".styles-btn").click()`); await sleep(300);
await ev(`[...document.querySelectorAll(".style-apply")].find(b => b.querySelector(".style-name").textContent === "Two-stage").click()`); await sleep(400);
const n0 = await count();
// 1. double-click right ON an existing handle: must not add a hidden twin
const h = await ev(`(() => { const r = document.querySelectorAll("circle.handle")[2].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const fxy = [(h[0] - box[0]) / box[2], (h[1] - box[1]) / box[3]];
await dbl(fxy[0], fxy[1]);
ok(await count() === n0, `double-click on a point adds nothing (${n0} -> ${await count()})`);
// 2. double-click in empty space: adds
await dbl(0.9, 0.12);
ok(await count() === n0 + 1, `double-click in empty space adds one (${n0} -> ${await count()})`);
// 3. + Add button: adds on the curve, says so
await ev(`document.querySelector(".add-btn").click()`); await sleep(200);
ok(await count() === n0 + 2, `+ Add adds one (-> ${await count()}): "${await flash()}"`);
// 4. fill to the cap, then refusal is explained
for (let i = 0; i < 12; i++) { await ev(`document.querySelector(".add-btn").click()`); await sleep(60); }
ok(await count() === 10, `stops at 10 points (${await count()})`);
await dbl(0.97, 0.05);
ok(/Maximum/.test(await flash()), `at the cap, double-click explains: "${await flash()}"`);
console.log(fails ? `${fails} failed` : "all passed");
chrome.kill(); process.exit(0);
