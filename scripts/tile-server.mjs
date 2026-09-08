/*
  Static file server for the map tile pyramid, for local development only.

  The tiles are 2.0 GB across 27,306 files. They are deliberately not in this
  repo and not in public/ — a deploy pipeline will choke on them. In production
  NEXT_PUBLIC_TILE_BASE points at object storage (R2/S3); locally it points
  here, so the app code is identical either way.

  usage: node scripts/tile-server.mjs [root] [port]
  default root: E:/WARDOGSPILOT   default port: 8788
*/
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] || process.env.TILE_ROOT || "E:/WARDOGSPILOT");
const port = Number(process.argv[3] || process.env.TILE_PORT || 8788);

const TYPES = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};

createServer((req, res) => {
  // CORS: the app is on :3000, the tiles are here
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  const url = new URL(req.url, "http://localhost");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
  const file = join(root, rel);

  // never serve outside the root, whatever the request says
  if (!file.startsWith(root + sep)) return res.writeHead(403).end("forbidden");

  let st;
  try {
    st = statSync(file);
  } catch {
    return res.writeHead(404).end("not found");
  }
  if (!st.isFile()) return res.writeHead(404).end("not found");

  res.writeHead(200, {
    "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": st.size,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`tiles: serving ${root} on http://localhost:${port}`);
  console.log(`       e.g. http://localhost:${port}/tiles/ozeti/0/0_0.webp`);
});
