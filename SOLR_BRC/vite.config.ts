import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";

/*
  The bridge between the browser and T.A.R.G.E.T.

  The browser cannot write to C:\SolR, so the dev server does it. Three files, all
  next to the .tmc script:

    hotas_curves.json  the app's own state (what the sliders were), reloaded
                       when the app opens
    hotas_curves.txt   the lookup tables the script actually reads
    hotas_curves.ack   written BY THE SCRIPT: the table number it has loaded.
                       Only thing that proves the change reached T.A.R.G.E.T.
*/
const DIR = process.env.SOLR_DIR ?? "C:/SolR/";
const STATE = path.join(DIR, "hotas_curves.json");
const TABLE = path.join(DIR, "hotas_curves.txt");
const ACK = path.join(DIR, "hotas_curves.ack");
const PRESETS = path.join(DIR, "hotas_presets.json");
const STYLES = path.join(DIR, "hotas_curve_styles.json");

const NTAB = 3 * 257;
const AMAX = 32767;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/*
  Write to a temp file and rename over the target, so the script never sees a
  half-written table. On Windows the rename fails while the script has the
  file open (it does, for a moment, four times a second), hence the retries.
  The gen-at-both-ends check in the script is the second line of defence.
*/
async function atomicWrite(file: string, data: string) {
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, data);
  for (let i = 0; ; i++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (e) {
      if (i >= 20) throw e;
      await sleep(25);
    }
  }
}

const readText = (f: string) => fs.readFile(f, "utf8").catch(() => null);

function body(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => res(s));
    req.on("error", rej);
  });
}

function bridge(): Plugin {
  return {
    name: "solr-bridge",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res) => {
        const send = (code: number, obj: unknown) => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(obj));
        };
        try {
          if (req.method === "GET" && req.url === "/state") {
            const s = await readText(STATE);
            return send(200, { state: s ? JSON.parse(s) : null, dir: DIR });
          }
          if (req.method === "GET" && req.url === "/ack") {
            const a = await readText(ACK);
            return send(200, { ack: a === null ? null : Number(a.trim()) });
          }
          if (req.method === "GET" && req.url === "/styles") {
            const s = await readText(STYLES);
            const list = s ? JSON.parse(s) : [];
            return send(200, Array.isArray(list) ? list : []);
          }
          if (req.method === "POST" && req.url === "/styles") {
            const list = JSON.parse(await body(req));
            if (!Array.isArray(list)) return send(400, { error: "styles must be a list" });
            await atomicWrite(STYLES, JSON.stringify(list, null, 2));
            return send(200, { ok: true });
          }
          if (req.method === "GET" && req.url === "/presets") {
            const s = await readText(PRESETS);
            const list = s ? JSON.parse(s) : [];
            return send(200, Array.isArray(list) ? list : []);
          }
          if (req.method === "POST" && req.url === "/presets") {
            const list = JSON.parse(await body(req));
            if (!Array.isArray(list)) return send(400, { error: "presets must be a list" });
            await atomicWrite(PRESETS, JSON.stringify(list, null, 2));
            return send(200, { ok: true });
          }
          if (req.method === "POST" && req.url === "/state") {
            const { state, table, gen, note } = JSON.parse(await body(req));
            if (
              !Array.isArray(table) || table.length !== NTAB ||
              !table.every((v) => Number.isInteger(v) && Math.abs(v) <= AMAX) ||
              !Number.isInteger(gen) || gen <= 0
            ) {
              return send(400, { error: "bad table" });
            }
            const rows: string[] = [];
            for (let i = 0; i < NTAB; i += 16) rows.push(table.slice(i, i + 16).join(" "));
            // the log line the script prints: printable ASCII, one line, after '#'
            const log = typeof note === "string" ? note.replace(/[^\x20-\x7e]/g, "?").slice(0, 190) : "";
            await atomicWrite(TABLE, `${gen}\r\n${rows.join("\r\n")}\r\n${gen}\r\n#${log}\r\n`);
            await atomicWrite(STATE, JSON.stringify(state, null, 2));
            return send(200, { ok: true, gen });
          }
          send(404, { error: "not found" });
        } catch (e) {
          send(500, { error: String(e) });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), bridge()],
  // Tauri loads the UI from here in `npm run dev`, so the port must not drift
  server: { port: 5178, strictPort: true },
  clearScreen: false,
});
