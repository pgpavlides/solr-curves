/*
  Refuse to build while a dev server is running.

  `next build` and `next dev` share `.next`. Building over a live dev server
  rewrites that directory underneath it, and the dev server then throws
  `Cannot find module './NNN.js'` on the next request — for whichever chunk id
  happens to have moved. It has cost this project three separate debugging
  sessions ('833.js', '/_document', '694.js'), every one of them looking like a
  code bug and none of them being one.

  distDir cannot be used to separate them: with `output: "export"` a custom
  distDir sends the exported site there instead of `out/`, silently stranding
  the deploy. So the fix is to stop, not to split.

  DETECT BY CONNECTING, NOT BY BINDING. The obvious check — try to listen on
  the port and treat EADDRINUSE as "busy" — does not work on Windows, where
  binding a port another process is already listening on simply SUCCEEDS. That
  version of this script sat here reporting all clear while the dev server it
  was meant to protect was actively being corrupted. A TCP connect either
  reaches a listener or it does not, on every platform.

  Set SKIP_DEV_CHECK=1 to override.
*/
import net from "node:net";

const PORTS = [3000, 3001, 3002];
const TIMEOUT_MS = 400;

if (process.env.SKIP_DEV_CHECK) process.exit(0);

const listening = (port) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (answer) => {
      socket.destroy();
      resolve(answer);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });

const busy = [];
for (const p of PORTS) if (await listening(p)) busy.push(p);

if (busy.length) {
  console.error(
    [
      "",
      `  Something is listening on ${busy.join(", ")} — probably \`npm run dev\`.`,
      "",
      "  Building now would rewrite .next underneath it, and the dev server would",
      "  start throwing `Cannot find module './NNN.js'` on every request.",
      "",
      "  Stop the dev server first, then build. If it has already happened,",
      "  `npm run clean` clears the cache.",
      "",
      "  To build anyway: SKIP_DEV_CHECK=1 npm run build",
      "",
    ].join("\n")
  );
  process.exit(1);
}
