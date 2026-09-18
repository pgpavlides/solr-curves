/*
  No-scroll check: at each window size, in S-curve and in custom-points mode
  with the maximum 10 points, nothing may scroll and no panel may cut off its
  content. Screenshots to shots/. Needs `npm run dev`. Run: node scripts/layout.mjs
*/
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9450 + Math.floor(Math.random() * 260);
const chrome = spawn(CHROME, ["--headless=new", "--no-first-run",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "lay-"))}`, `--remote-debugging-port=${port}`, "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let v;
for (let i = 0; i < 120 && !v; i++) { try { v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const ev = async (expression) => (await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
mkdirSync("shots", { recursive: true });

const PROBE = `(() => {
  const out = [];
  const d = document.documentElement;
  if (d.scrollHeight > innerHeight + 1 || d.scrollWidth > innerWidth + 1) out.push("PAGE " + d.scrollWidth + "x" + d.scrollHeight);
  for (const el of document.querySelectorAll(".left,.right,.side,.pts,.tabs,.readout")) {
    if (el.scrollHeight > el.clientHeight + 1) out.push(el.className + " clipped by " + (el.scrollHeight - el.clientHeight) + "px");
  }
  const g = document.querySelector(".graph").getBoundingClientRect();
  if (Math.min(g.width, g.height) < 300) out.push("graph only " + Math.round(Math.min(g.width, g.height)) + "px");
  return out;
})()`;
const clickText = (sel, text) => ev(`[...document.querySelectorAll("${sel}")].find(b => b.textContent.trim().startsWith("${text}"))?.click()`);

let fails = 0;
await S("Page.navigate", { url: process.env.APP ?? "http://localhost:5179/" });
await sleep(2500);
for (const [w, h] of [[1920, 1080], [1600, 900], [1366, 768], [1280, 720]]) {
  await S("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  for (const mode of ["S-curve", "Custom points"]) {
    await clickText(".seg button", mode);
    if (mode === "Custom points") {
      // fill to the 10-point maximum by double-clicking along the graph
      for (let k = 0; k < 8; k++) {
        await ev(`(() => { const g = document.querySelector(".graph"); const r = g.getBoundingClientRect();
          const x = r.left + r.width * (0.53 + ${k} * 0.05), y = r.top + r.height / 2 - 10;
          g.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: x, clientY: y })); })()`);
        await sleep(60);
      }
    }
    await sleep(400);
    const bad = await ev(PROBE);
    const n = await ev(`document.querySelectorAll(".pts tbody tr").length`);
    console.log(`${w}x${h} ${mode.padEnd(13)} ${mode === "Custom points" ? n + " pts " : "       "}${bad.length ? "FAIL " + bad.join("; ") : "ok"}`);
    if (bad.length) fails++;
    const shot = await S("Page.captureScreenshot", { format: "png" });
    writeFileSync(`shots/${w}x${h}-${mode === "S-curve" ? "s" : "pts"}.png`, Buffer.from(shot.result.data, "base64"));
  }
  await ev(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))`);
}
// leave the saved curve as it was: undo everything this run did
for (let i = 0; i < 60; i++) await ev(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))`);
await sleep(600);
chrome.kill();
console.log(fails ? `\n${fails} layouts failed` : "\nall layouts fit");
process.exit(fails ? 1 : 0);
