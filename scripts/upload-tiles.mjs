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
import { execFileSync } from "node:child_process";

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

/*
  THE TOKEN EXPIRES AFTER AN HOUR, AND THIS UPLOAD TAKES LONGER THAN THAT.

  The first run of this script learned that the hard way: it uploaded for an
  hour, the wrangler OAuth token expired at 20:30, and it then spent eleven
  hours retrying 401s forty times each — 5,500 "throttled" and 201 "failed"
  lines, and not one further byte uploaded. It looked like rate limiting in the
  log and was nothing of the sort.

  So: read the expiry, refresh before it lapses, and treat an auth failure as
  fatal-unless-a-refresh-fixes-it rather than as something to grind on.

  Refreshing is delegated to wrangler itself — any wrangler command renews the
  token on disk using the refresh_token — so there is no OAuth client id or
  grant flow reimplemented here.
*/
const WRANGLER_CONFIG = [
  join(process.env.APPDATA || process.env.HOME || "", "xdg.config", ".wrangler", "config", "default.toml"),
  join(process.env.HOME || "", ".wrangler", "config", "default.toml"),
].find(existsSync);

function readToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return { token: process.env.CLOUDFLARE_API_TOKEN, expires: Infinity };
  if (!WRANGLER_CONFIG) {
    throw new Error("no Cloudflare token: run `wrangler login` or set CLOUDFLARE_API_TOKEN");
  }
  const raw = readFileSync(WRANGLER_CONFIG, "utf8");
  const tok = raw.match(/oauth_token\s*=\s*"([^"]+)"/);
  const exp = raw.match(/expiration_time\s*=\s*"([^"]+)"/);
  if (!tok) throw new Error(`no oauth_token in ${WRANGLER_CONFIG}: run \`wrangler login\``);
  return { token: tok[1], expires: exp ? Date.parse(exp[1]) : Infinity };
}

let auth = readToken();
let refreshing = null;
let lastRefresh = 0;

/** Renew the token on disk, at most one wrangler process at a time. */
function refresh(why) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    console.log(`  refreshing the token (${why})`);
    try {
      execFileSync("npx", ["wrangler", "whoami"], { stdio: "ignore", timeout: 90_000, shell: true });
    } catch {
      // whoami can fail for reasons that are not the token; the re-read decides
    }
    const next = readToken();
    const moved = next.token !== auth.token;
    auth = next;
    console.log(
      moved
        ? `  token renewed, good until ${new Date(auth.expires).toISOString()}`
        : `  token did NOT change — run \`npx wrangler login\` in this terminal`
    );
    lastRefresh = Date.now();
    refreshing = null;
    return moved;
  })();
  return refreshing;
}

/*
  The current token, renewed if it is within ten minutes of lapsing.

  The cooldown matters: wrangler will not always renew a token it still
  considers valid, so without it a refusal here would spawn a wrangler process
  for every single upload. If the proactive renewal does not take, the 401
  handler picks it up once the token has actually lapsed.
*/
async function token() {
  const soon = Number.isFinite(auth.expires) && Date.now() > auth.expires - 10 * 60_000;
  if (soon && Date.now() - lastRefresh > 60_000) {
    lastRefresh = Date.now();
    await refresh("expiring");
  }
  return auth.token;
}

if (Number.isFinite(auth.expires)) {
  console.log(`token good until ${new Date(auth.expires).toISOString()}`);
}

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
      headers: { authorization: `Bearer ${await token()}`, "content-type": "image/webp" },
      body,
    });
    if (r.status === 401 || r.status === 403) {
      // Not transient. Renew once; if that changes nothing, stop the whole run
      // rather than hammering a dead credential for eleven hours.
      await r.arrayBuffer();
      if (await refresh(`HTTP ${r.status}`)) return put(job, attempt);
      console.error(
        `
  ${r.status} from Cloudflare and the token would not renew.` +
        `
  Run \`npx wrangler login\`, then re-run this script — it resumes from` +
        `
  .tiles-uploaded.log and re-sends nothing.
`
      );
      process.exit(2);
    }
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
