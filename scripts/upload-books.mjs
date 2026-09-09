/*
  Upload the reference library to R2.

  The PDFs are 252 MB across eight files and are NOT in this repo, and cannot
  be: Cloudflare Pages refuses any asset over 25 MB, and the Helicopter Flying
  Handbook alone is 171 MB. They live in the `wardogspilot-books` bucket behind
  books.wardogspilot.com and are fetched by the browser at click time.

  Auth is wrangler's own OAuth token, renewed on a 401 the same way
  scripts/upload-tiles.mjs does it — see the long note in that file for why an
  auth failure must never be retried as if it were transient.

  usage: node scripts/upload-books.mjs [dir]
    dir  default E:/WARDOGSPILOT.COM/BOOKS
*/
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const DIR = resolve(process.argv[2] || "E:/WARDOGSPILOT.COM/BOOKS");
const BUCKET = "wardogspilot-books";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "70550c5878353eb2a7ea961e3bb1a1ec";

const WRANGLER_CONFIG = [
  join(process.env.APPDATA || process.env.HOME || "", "xdg.config", ".wrangler", "config", "default.toml"),
  join(process.env.HOME || "", ".wrangler", "config", "default.toml"),
].find(existsSync);

function readToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  if (!WRANGLER_CONFIG) throw new Error("no token: run `wrangler login`");
  const m = readFileSync(WRANGLER_CONFIG, "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("no oauth_token on disk: run `wrangler login`");
  return m[1];
}
let token = readToken();

/** Renew only when a 401 says to — wrangler will not refresh a live token. */
function renew(stale) {
  try {
    execFileSync("npx", ["wrangler", "whoami"], { stdio: "ignore", timeout: 90_000, shell: true });
  } catch {}
  token = readToken();
  return token !== stale;
}

/*
  The key is the filename, tidied: lowercase, spaces and punctuation to
  hyphens. These end up in a URL the reader can see, so
  "ICAO Doc 9432 Manual of Radiotelephony (4th ed. 2007).pdf" should not.
*/
export const keyFor = (name) =>
  name
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + ".pdf";

/** A .pdf that is really a saved web page is not a book. */
function isPdf(file) {
  const head = readFileSync(file).subarray(0, 5).toString("latin1");
  return head === "%PDF-";
}

const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
const good = [];
for (const f of files) {
  const full = join(DIR, f);
  if (isPdf(full)) good.push({ file: full, name: f, key: keyFor(f), size: statSync(full).size });
  else console.warn(`  SKIPPED ${f} — not a PDF (saved web page?)`);
}

const total = good.reduce((n, g) => n + g.size, 0);
console.log(`${good.length} books, ${(total / 1048576).toFixed(1)} MB\n`);

let sent = 0;
for (const g of good) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${g.key}`;
  const body = readFileSync(g.file);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const stale = token;
    const started = Date.now();
    const r = await fetch(url, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${stale}`,
        "content-type": "application/pdf",
        // so a click opens the reader rather than downloading a blob
        "content-disposition": `inline; filename="${g.key}"`,
      },
      body,
    });
    if (r.status === 401 || r.status === 403) {
      await r.arrayBuffer();
      if (renew(stale)) continue;
      console.error("token would not renew — run `npx wrangler login`");
      process.exit(2);
    }
    if (r.ok) {
      await r.arrayBuffer();
      sent++;
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `  ${String(Math.round(g.size / 1048576)).padStart(4)} MB  ${secs.padStart(6)}s  ${g.key}`
      );
      break;
    }
    const text = (await r.text()).slice(0, 160);
    if (attempt === 4) {
      console.error(`  FAILED ${g.key}: ${r.status} ${text}`);
    } else {
      console.warn(`  retry ${g.key}: ${r.status}`);
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
}
console.log(`\n${sent}/${good.length} uploaded to https://books.wardogspilot.com/`);
process.exit(sent === good.length ? 0 : 1);
