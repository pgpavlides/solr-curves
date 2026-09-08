/*
  Generate the social cards in public/og/.

  Rendered with headless Chrome rather than next/og. Under `output: "export"`
  there is no server to generate an image on request, and baking them as plain
  files means a card cannot fail to render at share time — it is just a PNG.
  The trade is that they are build artifacts committed to the repo: re-run this
  after changing the mark or the copy.

  usage: node scripts/make-og.mjs
*/
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "og");
const CHROME =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

/* The cards. One per section; the four write-ups share the guides card. */
const CARDS = [
  { file: "default", kicker: "wardogspilot.com", title: "The WARDOGS helicopter reference",
    sub: "A 3D maneuver simulator, the community's videos with every author credited, the game maps, and the terminology." },
  { file: "simulator", kicker: "Simulator", title: "Fly the maneuvers",
    sub: "Every maneuver flown in 3D, with the pilot's collective, cyclic and pedals moving live beside it." },
  { file: "videos", kicker: "Videos", title: "The people this is built on",
    sub: "Every video the site was built from, grouped by the creator who made it, and linked back to them." },
  { file: "maps", kicker: "Maps", title: "Ozeti and Bakurani",
    sub: "Interactive game maps with towers, zones, facilities and ladders as layers — and a pen to mark them up." },
  { file: "terminology", kicker: "Terminology", title: "The words, defined",
    sub: "Collective, cyclic, crab, flare, AGL and the rest — what each one means, and the trap in it." },
  { file: "guides", kicker: "Guides", title: "Written up from the community",
    sub: "Settings, numbers and technique, with the original one click away and the author credited at the top." },
  { file: "pilot-app", kicker: "Pilot App", title: "The second screen",
    sub: "A desktop companion — the reference beside the game instead of behind it. In development." },
];

/* The mark, recoloured the way components/Logo.tsx does it. */
const logo = readFileSync(join(ROOT, "public", "logo.svg"), "utf8")
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/<style>[\s\S]*?<\/style>/, "")
  .replace(/<defs>\s*<\/defs>/, "")
  .replace(/class="cls-1"/g, 'fill="#2b303b"')
  .replace("<svg ", '<svg class="mark" ');

const page = (c) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    display: flex; align-items: center; gap: 64px;
    padding: 0 84px;
    background:
      radial-gradient(ellipse 90% 70% at 22% 50%, rgba(71,81,92,.34) 0%, rgba(27,28,34,0) 66%),
      radial-gradient(ellipse 70% 60% at 92% 8%, rgba(71,81,92,.20) 0%, rgba(27,28,34,0) 60%),
      #1b1c22;
    color: #cfd8e6;
    font-family: Inter, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .mark { width: 260px; height: 260px; flex: none; }
  /* the shield body sits over the dark polygon, exactly as on the site */
  .mark path, .mark polygon:not([fill]) { fill: #cfd8e6; }
  .col { min-width: 0; }
  .word {
    font-family: "Space Grotesk", Inter, sans-serif;
    font-weight: 600; font-size: 34px; letter-spacing: .17em;
    text-transform: uppercase; color: #cfd8e6;
  }
  .rule { width: 190px; height: 1px; margin: 22px 0;
    background: linear-gradient(90deg, rgba(207,216,230,.85), rgba(207,216,230,0)); }
  .kicker {
    font-family: "JetBrains Mono", monospace; font-size: 19px;
    letter-spacing: .16em; text-transform: uppercase; color: #8b93a1;
  }
  .title {
    font-family: "Space Grotesk", Inter, sans-serif;
    font-weight: 600; font-size: 62px; line-height: 1.08; letter-spacing: -.02em;
    color: #eef2f7; margin: 12px 0 20px; text-wrap: balance;
  }
  .sub { font-size: 25px; line-height: 1.5; color: #98a1af; max-width: 30ch; }
  .foot {
    position: absolute; right: 84px; bottom: 46px;
    font-family: "JetBrains Mono", monospace; font-size: 17px;
    letter-spacing: .09em; color: #6d7684;
  }
</style></head><body>
  ${logo}
  <div class="col">
    <div class="word">wardogspilot</div>
    <div class="rule"></div>
    <div class="kicker">${c.kicker}</div>
    <h1 class="title">${c.title}</h1>
    <p class="sub">${c.sub}</p>
  </div>
  <div class="foot">wardogspilot.com</div>
</body></html>`;

/* ------------------------------------------------------------------ CDP */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9100 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "og-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "about:blank",
]);
chrome.on("error", (e) => { console.error("chrome failed to start:", e.message); process.exit(1); });

async function version() {
  for (let i = 0; i < 90; i++) {
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
/*
  1200x630 exactly — the canonical card size. deviceScaleFactor and clip.scale
  MULTIPLY, so setting both to 2 gave 4800x2520 files of 1.9 MB each, which is
  past what some scrapers will fetch and pointless besides: every platform
  downscales to 1200 wide or less.
*/
await S("Emulation.setDeviceMetricsOverride", {
  width: 1200, height: 630, deviceScaleFactor: 1, mobile: false,
});

mkdirSync(OUT, { recursive: true });
for (const c of CARDS) {
  await S("Page.navigate", {
    url: "data:text/html;charset=utf-8," + encodeURIComponent(page(c)),
  });
  await sleep(900);
  // without this the cards render in the fallback face and the kerning is wrong
  await S("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
  await sleep(250);
  const shot = await S("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
  });
  const buf = Buffer.from(shot.data, "base64");
  const file = join(OUT, `${c.file}.png`);
  writeFileSync(file, buf);
  console.log(`${String(Math.round(buf.length / 1024)).padStart(4)} KB  og/${c.file}.png`);
}

ws.close();
chrome.kill();
console.log(`\n${CARDS.length} cards written to public/og/`);
process.exit(0);
