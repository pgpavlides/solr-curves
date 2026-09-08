/*
  Refuse to build a production bundle that points at a local tile server.

  NEXT_PUBLIC_* is inlined at build time, not read at runtime, and `next build`
  reads .env.local. The first deploy of the map therefore shipped
  NEXT_PUBLIC_TILE_BASE=http://localhost:8788 to the whole internet: the map
  loaded, the markers and polygons drew, and the terrain was blank for everyone
  whose machine was not mine.

  .env.production now pins the public host, and this makes sure of it.

  Set SKIP_TILE_CHECK=1 to build anyway — for a deliberately tile-less build.
*/
import { existsSync, readFileSync } from "node:fs";

if (process.env.SKIP_TILE_CHECK) process.exit(0);

/** What `next build` will actually inline, in the order Next resolves it. */
function resolveTileBase() {
  if (process.env.NEXT_PUBLIC_TILE_BASE) {
    return { value: process.env.NEXT_PUBLIC_TILE_BASE, from: "the environment" };
  }
  // .env.local wins over .env.production for `next build`
  for (const file of [".env.local", ".env.production", ".env"]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(/^\s*NEXT_PUBLIC_TILE_BASE\s*=\s*(.+)$/m);
    if (m) return { value: m[1].trim().replace(/^["']|["']$/g, ""), from: file };
  }
  return { value: "", from: "nowhere" };
}

const { value, from } = resolveTileBase();
const local = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(value);

if (!value || local) {
  console.error(
    [
      "",
      value
        ? `  NEXT_PUBLIC_TILE_BASE is ${value} (from ${from}).`
        : `  NEXT_PUBLIC_TILE_BASE is not set (looked in the environment, .env.local, .env.production, .env).`,
      "",
      "  That value is baked into the bundle at build time. Shipping it means the",
      "  map renders with markers and zones but no terrain for anyone but you.",
      "",
      "  .env.production pins the public host. If .env.local is overriding it for",
      "  a deploy build, move it aside or run:",
      "",
      "    NEXT_PUBLIC_TILE_BASE=https://tiles.wardogspilot.com npm run build",
      "",
      "  To build without tiles on purpose: SKIP_TILE_CHECK=1 npm run build",
      "",
    ].join("\n")
  );
  process.exit(1);
}

console.log(`tiles: ${value} (from ${from})`);
