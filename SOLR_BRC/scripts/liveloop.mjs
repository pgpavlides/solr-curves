/*
  Regression check for the "Maximum update depth exceeded" loop: with the
  script's ack matching (badge Live), the app must log no React errors.
  Needs the test server on 5179 (SOLR_DIR=.testdata/). Run: node scripts/liveloop.mjs
*/
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const D = (process.env.SOLR_DIR ?? ".testdata/").replace(/\\/g, "/");
const port = 9450 + Math.floor(Math.random() * 260);
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-first-run",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "ll-"))}`, `--remote-debugging-port=${port}`, "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let v;
for (let i = 0; i < 120 && !v; i++) { try { v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}, sessionId) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const ev = async (e) => (await S("Runtime.evaluate", { expression: e, returnByValue: true })).result.result.value;
await S("Runtime.enable");
await S("Page.navigate", { url: "http://localhost:5179/" });
await sleep(2500);

// play the script: acknowledge the table the app just wrote
const gen = readFileSync(D + "hotas_curves.txt", "latin1").trim().split(/\s+/)[0];
writeFileSync(D + "hotas_curves.ack", gen);
await sleep(6000);

const badge = await ev(`document.querySelector(".sync").textContent`);
console.log(`badge: ${badge}`);
console.log(`React errors in 6 s while live: ${errors.length}${errors[0] ? "  first: " + errors[0] : ""}`);
chrome.kill();
const ok = /Live/.test(badge) && errors.length === 0;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
