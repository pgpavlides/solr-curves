/*
  Upload the tile pyramid to R2.

  27,306 files and 2.0 GB, which is why they are not in this repo. `wrangler r2
  object put` is one process per object — about eleven hours — so this talks to
  the R2 REST API directly, many at a time.

  Auth comes from wrangler's own OAuth token, so there is no key to create or
  store. Set CLOUDFLARE_API_TOKEN to override.

  It is RESUMABLE: every uploaded key is appended to .tiles-uploaded.log, and
  a re-run skips them. Interrupt it freely.

  usage: node scripts/upload-tiles.mjs [root] [bucket]
    root   default E:/WARDOGSPILOT
    bucket default wardogspilot-tiles
*/
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(process.argv[2] || "E:/WARDOGSPILOT");
const BUCKET = process.argv[3] || "wardogspilot-tiles";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "70550c5878353eb2a7ea961e3bb1a1ec";
/*
  Cloudflare's management API allows roughly 1200 requests per five minutes —
  about four a second. At 24 in flight it answers 429 (code 971, "consider
  throttling your request speed") for most of them. This is paced just under
  the ceiling instead, which is slower but finishes.

  The fast path is the S3 API, which is the data plane and has no such limit,
  but it needs an R2 access key pair that neither wrangler's OAuth token nor
  the MCP token is allowed to mint.
*/
const CONCURRENCY = Number(process.env.TILE_CONCURRENCY || 4);
const GAP_MS = Number(process.env.TILE_GAP_MS || 120);
const LEDGER = resolve("./.tiles-uploaded.log");

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const p = join(
    process.env.APPDATA || process.env.HOME || "",
    "xdg.config", ".wrangler", "config", "default.toml"
  );
  const alt = join(process.env.HOME || "", ".wrangler", "config", "default.toml");
  for (const f of [p, alt]) {
    if (existsSync(f)) {
      const m = readFileSync(f, "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    }
  }
  throw new Error("no Cloudflare token: run `wrangler login` or set CLOUDFLARE_API_TOKEN");
}
const TOKEN = token();

/** Every .webp under tiles/, as a key relative to the root. */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith(".webp")) out.push(full);
  }
  return out;
}

const done = new Set(
  existsSync(LEDGER) ? readFileSync(LEDGER, "utf8").split("\n").filter(Boolean) : []
);

const files = walk(join(ROOT, "tiles"));
const jobs = files
  .map((f) => ({ file: f, key: relative(ROOT, f).split(sep).join("/") }))
  .filter((j) => !done.has(j.key));

const total = files.length;
console.log(`${total} tiles on disk, ${done.size} already up, ${jobs.length} to send`);
if (!jobs.length) {
  console.log("nothing to do");
  process.exit(0);
}

let sent = 0, bytes = 0, failed = 0, throttled = 0;
const started = Date.now();

async function put(job, attempt = 1) {
  const body = readFileSync(job.file);
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${job.key}`;
  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "image/webp" },
      body,
    });
    if (r.status === 429) {
      // a rate limit is a queue, not a failure: wait and come back to it
      const wait = Number(r.headers.get("retry-after") || 0) * 1000 || 2000 * attempt;
      throttled++;
      await new Promise((res) => setTimeout(res, Math.min(wait, 30000)));
      return put(job, attempt + 1);
    }
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 120)}`);
    await r.arrayBuffer();
    appendFileSync(LEDGER, job.key + "\n");
    sent++; bytes += body.length;
    if (GAP_MS) await new Promise((res) => setTimeout(res, GAP_MS));
  } catch (e) {
    if (attempt <= 40) {
      await new Promise((res) => setTimeout(res, Math.min(30000, 400 * attempt)));
      return put(job, attempt + 1);
    }
    failed++;
    console.error(`FAILED ${job.key}: ${e.message}`);
  }
}

const tick = setInterval(() => {
  const s = (Date.now() - started) / 1000;
  const pct = ((done.size + sent) / total * 100).toFixed(1);
  const mb = (bytes / 1048576).toFixed(0);
  const rate = (sent / s).toFixed(1);
  const left = jobs.length - sent;
  const eta = rate > 0 ? Math.round(left / rate) : 0;
  console.log(`  ${pct}%  ${done.size + sent}/${total}  ${mb} MB  ${rate}/s  eta ${Math.floor(eta / 60)}m${eta % 60}s${throttled ? `  ${throttled} throttled` : ""}${failed ? `  ${failed} failed` : ""}`);
}, 10000);

let cursor = 0;
async function worker() {
  while (cursor < jobs.length) await put(jobs[cursor++]);
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

clearInterval(tick);
const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\ndone: ${sent} uploaded, ${failed} failed, ${(bytes / 1048576).toFixed(0)} MB in ${secs}s`);
process.exit(failed ? 1 : 0);
