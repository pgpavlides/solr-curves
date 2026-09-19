import { invoke } from "@tauri-apps/api/core";

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
