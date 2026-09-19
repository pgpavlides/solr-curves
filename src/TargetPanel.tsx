import { useEffect, useRef, useState } from "react";
import {
  type TargetLogLine, type TargetStatus,
  inTauri, onEvent, targetLog, targetStart, targetStartService, targetStatus, targetStop,
} from "./bridge";

/*
  The header badge, and behind it the T.A.R.G.E.T. script itself.

  In the desktop app the script is run by this app through Thrustmaster's
  service (target.rs), so the Script Editor never needs to be opened: the app
  starts the script when it opens (unless auto-start is off) and the script
  stops when the app closes. The panel shows its console - the same lines the
  Script Editor would print, including our dated curve log lines.

  In a plain browser there is no service access: just the badge.
*/

export type Sync = "loading" | "saving" | "waiting" | "live" | "offline" | "error";

const SYNC_TEXT = (sync: Sync, ack: number | null): string => ({
  loading: "Loading…",
  saving: "Saving…",
  waiting: "Waiting for the script…",
  live: "Live in T.A.R.G.E.T.",
  offline: ack === null ? "Script has never loaded a table" : "Script not picking up changes",
  error: "Can't write the curve files — click for details",
})[sync];

const AUTOSTART_KEY = "solr:autostart";

export default function TargetPanel({ sync, gen, ack, saveError, dir }: {
  sync: Sync; gen: number; ack: number | null; saveError?: string | null; dir?: string;
}) {
  const [status, setStatus] = useState<TargetStatus | null>(null);
  const [log, setLog] = useState<TargetLogLine[]>([]);
  const [busy, setBusy] = useState<"starting" | "stopping" | "service" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [autostart, setAutostart] = useState(() => {
    try { return localStorage.getItem(AUTOSTART_KEY) !== "0"; } catch { return true; }
  });
  const box = useRef<HTMLDivElement>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  const tried = useRef(false);

  const refresh = () => targetStatus().then((s) => s && setStatus(s)).catch(() => {});

  const start = async () => {
    setBusy("starting");
    setProblem(null);
    try {
      await targetStart();
    } catch (e) {
      // "service-stopped" has its own explanation and button in the panel
      if (String(e) !== "service-stopped") setProblem(String(e));
      setOpen(true);
    }
    setBusy(null);
    refresh();
  };
  const stop = async () => {
    setBusy("stopping");
    try { await targetStop(); } catch (e) { setProblem(String(e)); }
    setBusy(null);
    refresh();
  };

  // connect, read the log so far, follow new lines and status changes
  useEffect(() => {
    if (!inTauri) return;
    refresh();
    targetLog().then(setLog).catch(() => {});
    const offLog = onEvent<TargetLogLine>("solr:target-log", (l) => setLog((x) => [...x.slice(-399), l]));
    const offStatus = onEvent("solr:target-status", () => refresh());
    const t = setInterval(refresh, 3000);
    return () => { offLog(); offStatus(); clearInterval(t); };
  }, []);

  const serviceDown = status?.error === "service-stopped";
  const startService = async () => {
    setBusy("service");
    setProblem(null);
    try { await targetStartService(); } catch (e) { setProblem(String(e)); setOpen(true); }
    setBusy(null);
    refresh();
  };

  // one app: start the script as soon as we know it isn't running - on
  // opening, and again whenever Thrustmaster's service comes back after
  // being down (it has crashed under low memory before)
  const wasDown = useRef(false);
  useEffect(() => {
    if (!status) return;
    if (serviceDown) { wasDown.current = true; return; }
    const back = wasDown.current && status.connected;
    if (back) wasDown.current = false;
    if (!autostart || (tried.current && !back)) return;
    tried.current = true;
    if (status.connected && !status.running) start();
  }, [status, autostart]);

  useEffect(() => {
    try { localStorage.setItem(AUTOSTART_KEY, autostart ? "1" : "0"); } catch { /* not remembered */ }
  }, [autostart]);

  useEffect(() => {
    if (!open) return;
    logEnd.current?.scrollIntoView({ block: "end" });
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const click = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("mousedown", click);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("mousedown", click); };
  }, [open, log.length]);

  if (!inTauri) {
    return (
      <div className={`sync ${sync}`} title={`table #${gen} · script has #${ack ?? "none"}`}>
        <span className="dot" />{SYNC_TEXT(sync, ack)}
      </div>
    );
  }

  // what the badge says: the script's own state first, then the curve sync
  const running = !!status?.running;
  let cls: string = sync;
  let text = SYNC_TEXT(sync, ack);
  if (busy === "starting") { cls = "waiting"; text = "Starting script…"; }
  else if (busy === "stopping") { cls = "waiting"; text = "Stopping script…"; }
  else if (busy === "service") { cls = "waiting"; text = "Starting Thrustmaster service…"; }
  else if (serviceDown) { cls = "error"; text = "Thrustmaster service stopped"; }
  else if (status && !status.connected) { cls = "error"; text = status.available ? "T.A.R.G.E.T. service unreachable" : "T.A.R.G.E.T. not installed"; }
  else if (status && !running) { cls = "offline"; text = problem ? "Script failed — see log" : "Script stopped"; }

  return (
    <div className="target" ref={box}>
      <button className={`sync sync-btn ${cls}`} onClick={() => setOpen((o) => !o)} title={`table #${gen} · script has #${ack ?? "none"}`}>
        <span className="dot" />{text}<span className="caret">▾</span>
      </button>

      {open && (
        <div className="target-pop">
          <div className="target-head">
            <div>
              <b>T.A.R.G.E.T. script</b>
              <div className="target-sub">{status?.script ?? "—"}</div>
            </div>
            <div className="target-actions">
              {running ? (
                <>
                  <button className="ghost-btn" onClick={start} disabled={!!busy} title="Stop, recompile and run again">Restart</button>
                  <button className="stop-btn" onClick={stop} disabled={!!busy}>Stop</button>
                </>
              ) : (
                <button className="add-btn" onClick={start} disabled={!!busy || !status?.connected}>Start</button>
              )}
            </div>
          </div>
          <label className="check target-auto">
            <input type="checkbox" checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />
            Start the script when Sol-R Curves opens · it stops when the app closes
          </label>
          {serviceDown && (
            <div className="service-down">
              <div>
                <b>Thrustmaster FAST service isn't running</b>
                <p className="hint">
                  It runs every T.A.R.G.E.T. script, so nothing works until it's back. It normally starts with Windows;
                  it can crash under low memory. Starting it needs admin approval - Windows will ask. Your script
                  starts again by itself afterwards.
                </p>
              </div>
              <button className="add-btn" onClick={startService} disabled={!!busy}>Start Thrustmaster service</button>
            </div>
          )}
          {(problem || (status?.error && !serviceDown)) && <p className="hint warn">{problem ?? status?.error}</p>}
          {sync === "error" && saveError && (
            <p className="hint warn">Saving the curves to {dir ?? "the curve folder"} failed: {saveError}. The next change tries again.</p>
          )}
          <div className="target-log">
            {log.length === 0 && <div className="log-empty">No output yet.</div>}
            {log.map((l, i) => (
              <div key={i} className={`log-${l.kind}`}>{l.text}</div>
            ))}
            <div ref={logEnd} />
          </div>
          <p className="hint">
            Runs in Thrustmaster's own service, exactly like the Script Editor's Run button — keep the Script Editor closed.
          </p>
        </div>
      )}
    </div>
  );
}
