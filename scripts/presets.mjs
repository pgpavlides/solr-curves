/*
  Presets, end to end in the browser build: save, change, load back, load
  one axis only, the log line, undo, delete - and the file on disk.
  Needs the test server on 5179 (SOLR_DIR=.testdata/). Run: node scripts/presets.mjs
*/
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const D = (process.env.SOLR_DIR ?? ".testdata/").replace(/\\/g, "/");
rmSync(D + "hotas_presets.json", { force: true });
const port = 9450 + Math.floor(Math.random() * 260);
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-first-run",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "pr-"))}`, `--remote-debugging-port=${port}`, "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let v;
for (let i = 0; i < 120 && !v; i++) { try { v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(String(m.params.args[0]?.value).slice(0, 160));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}, sessionId) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const ev = async (e) => (await S("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result.result.value;
await S("Runtime.enable");
await S("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await S("Page.navigate", { url: "http://localhost:5179/" });
await sleep(2500);

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const setValue = `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set`;
const setRange = (label, val) => ev(`(() => {
  const r = [...document.querySelectorAll(".field")].find(f => f.textContent.startsWith(${JSON.stringify(label)})).querySelector("input[type=range]");
  ${setValue}.call(r, ${JSON.stringify(String(val))});
  r.dispatchEvent(new Event("input", { bubbles: true }));
  r.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
})()`);
const openPop = () => ev(`document.querySelector(".presets-pop") ? 1 : document.querySelector(".presets-btn").click()`);
const closePop = () => ev(`document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))`);
const clickIn = (row, txt) => ev(`(() => {
  const p = [...document.querySelectorAll(".preset")].find(p => p.querySelector(".preset-name").textContent.startsWith(${JSON.stringify(row)}));
  const b = [...p.querySelectorAll("button")].find(b => b.textContent.trim() === ${JSON.stringify(txt)});
  b.click(); return true;
})()`);
const tab = (t) => ev(`[...document.querySelectorAll(".tabs button")].find(b => b.textContent.startsWith(${JSON.stringify(t)})).click()`);
const curveVal = () => ev(`[...document.querySelectorAll(".field")].find(f => f.textContent.startsWith("Curve")).querySelector(".num").value`);
const header = () => ev(`document.querySelector(".presets-btn").textContent`);
const note = () => { const t = readFileSync(D + "hotas_curves.txt", "latin1"); return t.slice(t.lastIndexOf("#") + 1).trim(); };
const presetsOnDisk = () => JSON.parse(readFileSync(D + "hotas_presets.json", "utf8"));

// start from the built-in default
await openPop(); await sleep(150);
await clickIn("Default (tuned)", "Load"); await sleep(900);

// 1. save "Hover" with roll curve 5
await setRange("Curve", 5); await sleep(300);
await openPop(); await sleep(150);
await ev(`(() => { const i = document.querySelector(".presets-save input"); ${setValue}.call(i, "Hover"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
await sleep(100);
await ev(`document.querySelector(".presets-save .add-btn").click()`);
await sleep(600);
const file = existsSync(D + "hotas_presets.json") ? presetsOnDisk() : [];
ok(file.length === 1 && file[0].name === "Hover" && file[0].axes.roll.pos.curve === 5, "saved to hotas_presets.json with roll curve 5");
ok(/Hover/.test(await header()) && !/modified/.test(await header()), `header shows it active: "${await header()}"`);

// 2. change it -> modified
await closePop(); await sleep(100);
await setRange("Curve", -3); await sleep(400);
ok(/modified/.test(await header()), "editing marks the preset modified");

// 3. load it back
await openPop(); await sleep(150);
await clickIn("Hover", "Load"); await sleep(1000);
ok((await curveVal()) === "5", `Load restores roll curve 5 (got ${await curveVal()})`);
ok(/Preset "Hover" loaded$/.test(note()), `log line: "${note()}"`);

// 4. Pitch only from Linear
await tab("Pitch"); await sleep(150);
await openPop(); await sleep(150);
await clickIn("Linear", "Pitch only"); await sleep(1000);
ok((await curveVal()) === "0", "Pitch only: pitch took Linear's curve 0");
await tab("Roll"); await sleep(150);
ok((await curveVal()) === "5", "...and roll kept its curve 5");
ok(/\(Pitch only\)$/.test(note()), `log line: "${note()}"`);

// 5. Ctrl+Z undoes the load
await ev(`document.activeElement && document.activeElement.blur(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))`);
await sleep(300);
await tab("Pitch"); await sleep(150);
ok((await curveVal()) === "2", `Ctrl+Z undid the pitch load (curve ${await curveVal()})`);

// 6. delete needs two clicks
await openPop(); await sleep(150);
await clickIn("Hover", "×"); await sleep(150);
ok(presetsOnDisk().length === 1, "first × only asks");
await clickIn("Hover", "Delete?"); await sleep(500);
ok(presetsOnDisk().length === 0, "second click deletes");

ok(errors.length === 0, `no console errors (${errors.length})${errors[0] ? ": " + errors[0] : ""}`);
chrome.kill();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
