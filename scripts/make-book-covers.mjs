/*
  Render a cover image for each book in public/books/.

  Drawn with pdf.js in headless Chrome, reading the PDFs straight off
  books.broccolipilot.com. That matters for the 171 MB handbook: R2 answers
  range requests, so pdf.js pulls the few hundred KB it needs for page one
  instead of the whole file.

  Screenshotting Chrome's built-in PDF viewer was the other option and it is
  worse — every capture comes with the viewer's toolbar and thumbnail rail
  baked in, and the page sits at a different offset in each document.

  The covers are build artifacts committed to the repo: re-run this after
  adding a book.

  usage: node scripts/make-book-covers.mjs
*/
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "books");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "https://books.broccolipilot.com";
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

const KEYS = [
  "helicopter-flying-handbook-2019pdf",
  "faa-rotorcraft-flying-handbook-2000",
  "pre-flight-briefing",
  "r22-poh-full-book",
  "r44-1-poh-full-book",
  "icao-doc-9432-manual-of-radiotelephony-4th-ed-2007",
  "fly-neighborly-guide",
  "r22-external-check-presentation",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9560 + Math.floor(Math.random() * 300);
spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "cov-"))}`,
  `--remote-debugging-port=${port}`, "about:blank",
]);
async function version() {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return r.json(); } catch {}
    await sleep(250);
  }
  throw new Error("chrome never came up");
}
const v = await version();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const send = (me, p = {}, s) => new Promise((res, rej) => {
  const n = ++id; pending.set(n, { res, rej });
  ws.send(JSON.stringify({ id: n, method: me, params: p, sessionId: s }));
});
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S("Page.enable"); await S("Runtime.enable");
const ev = async (expr, ms = 180000) =>
  (await send("Runtime.evaluate",
    { expression: expr, returnByValue: true, awaitPromise: true, timeout: ms }, sessionId)).result.value;

// a page on the same origin as the PDFs, so pdf.js needs no CORS grant
await S("Page.navigate", { url: `${BASE}/` });
await sleep(1500);
await ev(`new Promise((done) => {
  const s = document.createElement("script");
  s.src = "${PDFJS}/pdf.min.js";
  s.onload = done; s.onerror = () => done();
  document.documentElement.appendChild(s);
})`);
const ready = await ev(`typeof pdfjsLib !== "undefined"`);
if (!ready) { console.error("pdf.js did not load"); process.exit(1); }
await ev(`pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS}/pdf.worker.min.js"; true`);

mkdirSync(OUT, { recursive: true });
for (const key of KEYS) {
  const out = await ev(`(async () => {
    const doc = await pdfjsLib.getDocument({ url: "${BASE}/${key}.pdf", disableAutoFetch: true, disableStream: false }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = 620 / base.width;          // one width for every cover
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);  // pages are often transparent
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { data: c.toDataURL("image/jpeg", 0.82), pages: doc.numPages, w: c.width, h: c.height };
  })()`);
  if (!out) { console.error(`  FAILED ${key}`); continue; }
  const buf = Buffer.from(out.data.split(",")[1], "base64");
  writeFileSync(join(OUT, `${key}.jpg`), buf);
  console.log(`${String(Math.round(buf.length / 1024)).padStart(4)} KB  ${out.w}x${out.h}  ${String(out.pages).padStart(3)}pp  ${key}.jpg`);
}
ws.close();
console.log(`\ncovers in public/books/`);
process.exit(0);
