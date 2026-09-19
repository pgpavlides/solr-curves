import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

/*
  Where the app's files go. Inside the Tauri window this is Rust
  (src-tauri/src/lib.rs); in a plain browser - `npm run web`, and the browser
  tests - it is the dev-server middleware in vite.config.ts. Same three
  operations, same file format, so the UI never knows which one it has.
*/

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface Loaded {
  state: unknown | null;
  dir: string;
}

export async function loadState(): Promise<Loaded> {
  if (inTauri) return invoke<Loaded>("load_state");
  return (await fetch("/api/state")).json();
}

export async function saveState(state: unknown, table: number[], gen: number, note: string): Promise<void> {
  if (inTauri) {
    await invoke("save_state", { state, table, gen, note });
    return;
  }
  const r = await fetch("/api/state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, table, gen, note }),
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function loadPresets(): Promise<unknown[]> {
  if (inTauri) return invoke<unknown[]>("load_presets");
  return (await fetch("/api/presets")).json();
}

export async function savePresets(presets: unknown[]): Promise<void> {
  if (inTauri) {
    await invoke("save_presets", { presets });
    return;
  }
  const r = await fetch("/api/presets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(presets),
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function readAck(): Promise<number | null> {
  if (inTauri) return invoke<number | null>("read_ack");
  return (await (await fetch("/api/ack")).json()).ack;
}

/*
  The in-game overlay (Tauri only - a browser can't put a window over a game).
  The editor tells Rust to open/close/resize it, and pushes what to draw as
  events; the overlay asks for a push when it opens ("overlay-ready").
*/
export async function setOverlay(on: boolean, width: number, height: number): Promise<void> {
  if (!inTauri) return;
  await invoke("set_overlay", { on, width, height });
}

export function emitEvent(name: string, payload?: unknown) {
  if (inTauri) emit(name, payload).catch(() => {});
}

export function onEvent<T>(name: string, cb: (payload: T) => void): () => void {
  if (!inTauri) return () => {};
  let off: UnlistenFn | null = null;
  let dead = false;
  listen<T>(name, (e) => cb(e.payload)).then((u) => (dead ? u() : (off = u)));
  return () => {
    dead = true;
    off?.();
  };
}

/* WARDOGS's own bindings: which actions read the physical stick (Tauri only). */
export interface GameBindings {
  found: boolean;
  running: boolean;
  physical: string[];
}

export async function gameBindings(): Promise<GameBindings | null> {
  if (!inTauri) return null;
  return invoke<GameBindings>("game_bindings");
}

export async function fixGameBindings(): Promise<number> {
  return invoke<number>("fix_game_bindings");
}

/*
  The T.A.R.G.E.T. script, run by the app itself through Thrustmaster's
  service (src-tauri/src/target.rs) - no Script Editor needed.
*/
export interface TargetStatus {
  available: boolean; // T.A.R.G.E.T. installed
  connected: boolean; // talking to its service
  running: boolean;
  script: string;
  error: string | null;
}
export interface TargetLogLine {
  kind: "script" | "error" | "compile" | "warning" | "info";
  text: string;
}

export async function targetStatus(): Promise<TargetStatus | null> {
  if (!inTauri) return null;
  return invoke<TargetStatus>("target_status");
}
export const targetStart = () => invoke<void>("target_start");
export const targetStop = () => invoke<void>("target_stop");
export const targetLog = () => invoke<TargetLogLine[]>("target_log");
