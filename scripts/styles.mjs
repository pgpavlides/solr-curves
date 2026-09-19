/*
  Curve styles, end to end in the browser build: apply to an axis (and check
  the table the script reads), apply to ONE side of a split axis, save / delete
  a user style (and the file).
  Needs the test server on 5179 (SOLR_DIR=.testdata/). Run: node scripts/styles.mjs
*/
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const D = (process.env.SOLR_DIR ?? ".testdata/").replace(/\\/g, "/");
rmSync(D + "hotas_curve_styles.json", { force: true });
const port = 9450 + Math.floor(Math.random() * 260);
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-first-run",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "st-"))}`, `--remote-debugging-port=${port}`, "about:blank"]);
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

// start clean: the built-in default preset
await ev(`document.querySelector(".presets-btn").click()`); await sleep(150);
await ev(`[...document.querySelectorAll(".preset")].find(p => p.textContent.startsWith("Default (tuned)")).querySelector("button").click()`);
await sleep(900);

const openStyles = () => ev(`document.querySelector(".styles-modal") ? 1 : document.querySelector(".styles-btn").click()`);
const applyStyle = (name) => ev(`[...document.querySelectorAll(".style-apply")].find(b => b.querySelector(".style-name").textContent === ${JSON.stringify(name)}).click()`);
const tab = (t) => ev(`[...document.querySelectorAll(".tabs button")].find(b => b.textContent.startsWith(${JSON.stringify(t)})).click()`);
const field = (label) => ev(`[...document.querySelectorAll(".field")].find(f => f.textContent.startsWith(${JSON.stringify(label)}))?.querySelector(".num").value`);
const table = () => {
  const t = readFileSync(D + "hotas_curves.txt", "latin1").trim().split(/\s+/);
  return t.slice(1, 772).map(Number); // after the leading table number
};
const note = () => { const t = readFileSync(D + "hotas_curves.txt", "latin1"); return t.slice(t.lastIndexOf("#") + 1).trim(); };
const at = (tbl, axis, x) => tbl[axis * 257 + Math.round((x + 1) * 128)] / 32767;

console.log("   roll before:", "S", await field("Curve"), "dz", await field("Centre deadzone"), "sat", await field("End saturation"), "max", await field("Max output"), "| mode:", await ev(`document.querySelector(".seg button.on")?.textContent`));
ok(/Soft centre/.test(await ev(`document.querySelector(".styles-btn").title`)), `the style button names the current curve: "${await ev(`document.querySelector(".styles-btn").title`)}"`);

// 1. apply "Hover precision" to roll
await tab("Roll"); await sleep(150);
await openStyles(); await sleep(200);
ok((await ev(`document.querySelectorAll(".style-card").length`)) === 10, "10 built-in styles listed");
await applyStyle("Hover precision"); await sleep(900);
ok((await field("Curve")) === "4" && (await field("Centre deadzone")) === "2", `roll now S 4 · dz 2 (got S ${await field("Curve")} · dz ${await field("Centre deadzone")})`);
let t = table();
const expect = (Math.exp((0.5 - 0.02) * 4) - 1) / (Math.exp((1 - 0.02) * 4) - 1);
ok(Math.abs(at(t, 0, 0.5) - expect) < 0.01 && Math.abs(at(t, 1, 0.5) - at(t, 0, 0.5)) > 0.01, `table: roll at 50% = ${(at(t, 0, 0.5) * 100).toFixed(1)}% (S4), pitch untouched ${(at(t, 1, 0.5) * 100).toFixed(1)}%`);
ok(/Style "Hover precision" -> Roll \(both sides\)$/.test(note()), `log line (plain ASCII): "${note()}"`);

// 2. split pitch, style only its Forward side
await tab("Pitch"); await sleep(150);
await ev(`[...document.querySelectorAll(".sides button")].find(b => b.textContent.includes("Forward")).click()`); await sleep(200);
await openStyles(); await sleep(200);
ok(/Pitch · Forward/.test(await ev(`document.querySelector(".styles-intro").textContent`)), "the panel says it applies to Pitch · Forward");
await applyStyle("Limited 75%"); await sleep(900);
t = table();
ok(Math.abs(at(t, 1, -1) + 0.75) < 0.01 && Math.abs(at(t, 1, 1) - 1) < 0.01, `pitch forward stops at ${(at(t, 1, -1) * 100).toFixed(0)}%, back still reaches ${(at(t, 1, 1) * 100).toFixed(0)}%`);

// 3. save the current (forward) curve as a user style, then delete it
await openStyles(); await sleep(200);
await ev(`(() => { const i = document.querySelector(".styles-window .presets-save input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "My forward"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
await sleep(100);
await ev(`document.querySelector(".styles-window .presets-save .add-btn").click()`); await sleep(600);
const file = existsSync(D + "hotas_curve_styles.json") ? JSON.parse(readFileSync(D + "hotas_curve_styles.json", "utf8")) : [];
ok(file.length === 1 && file[0].name === "My forward" && file[0].side.outMax === 75, "saved to hotas_curve_styles.json with max output 75");
ok((await ev(`document.querySelectorAll(".style-card").length`)) === 11, "it appears as an 11th style");
await ev(`[...document.querySelectorAll(".style-card")].find(c => c.textContent.includes("My forward")).querySelector(".x").click()`); await sleep(150);
await ev(`[...document.querySelectorAll(".style-card")].find(c => c.textContent.includes("My forward")).querySelector(".x").click()`); await sleep(500);
ok(JSON.parse(readFileSync(D + "hotas_curve_styles.json", "utf8")).length === 0, "deleted after the confirm click");

// the window itself: fills the screen, every curve visible without scrolling
mkdirSync("shots", { recursive: true });
for (const [w, h] of [[1600, 900], [1280, 720]]) {
  await S("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await ev(`document.querySelector(".styles-modal") && document.querySelector(".styles-close").click()`); await sleep(150);
  await openStyles(); await sleep(400);
  const m = await ev(`(() => { const g = document.querySelector(".styles-grid"); const win = document.querySelector(".styles-window").getBoundingClientRect();
    const t = document.querySelector(".style-card .style-thumb").getBoundingClientRect();
    return { win: Math.round(win.width) + "x" + Math.round(win.height), scroll: g.scrollHeight - g.clientHeight, thumb: Math.round(Math.min(t.width, t.height)) }; })()`);
  ok(m.scroll <= 1 && m.thumb >= 120, `${w}x${h}: window ${m.win}, all curves fit (overflow ${m.scroll}px), previews ${m.thumb}px`);
  writeFileSync(`shots/styles-${w}x${h}.png`, Buffer.from((await S("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
}
await ev(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`); await sleep(200);
ok(!(await ev(`!!document.querySelector(".styles-modal")`)), "Esc closes it");

ok(errors.length === 0, `no console errors (${errors.length})${errors[0] ? ": " + errors[0] : ""}`);
chrome.kill();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
