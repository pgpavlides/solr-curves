import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { inTauri, onEvent } from "./bridge";

/*
  Live stick reading.

  Two devices matter: the physical Sol-R (what your hand does) and
  "Thrustmaster Combined" (what the script sends to the game). Plotting both on
  the curve is the proof that the curve on screen is the curve in the game.

  Your hand: while a T.A.R.G.E.T. script runs, the physical Sol-R is HIDDEN
  from Windows (games can then only bind Thrustmaster Combined), so the
  browser Gamepad API can't see it. In the desktop app it is read through
  T.A.R.G.E.T.'s filter instead (hidraw.rs, Thrustmaster's Device Analyzer
  library): same axis order, all 44 buttons, hidden or not. The Gamepad API
  stays as the fallback (plain browser, or no T.A.R.G.E.T.).

  The game side: Thrustmaster Combined through the Gamepad API.
  Browsers only list a gamepad after it has been touched with the page open.
*/

/** The part of a Gamepad this app uses - real or built from the raw feed. */
export interface PadLike {
  id: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
  /** hat direction, 0 = up then clockwise; -1 or undefined = centred */
  hat?: number;
}

export interface Pads {
  stick: PadLike | null;    // the physical Sol-R [R] Flightstick
  /** the Sol-R 6 Throttle (044f:0447), when it is connected */
  throttle: PadLike | null;
  combined: PadLike | null; // Thrustmaster Combined, 044f:ffff
  /** where `stick` comes from */
  stickSource: "target" | "windows" | null;
  frame: number;
}

interface RawStick {
  device: string;
  axes: number[];
  buttons: number[];
  hat: number | null;
}

const isStick = (g: Gamepad) => /044f/i.test(g.id) && /0422/i.test(g.id);
const isThrottle = (g: Gamepad) => /044f/i.test(g.id) && /0447/i.test(g.id);
const isCombined = (g: Gamepad) => (/044f/i.test(g.id) && /ffff/i.test(g.id)) || /combined/i.test(g.id);

/** `first`: the raw feed numbers the throttle's buttons from 45 (as the game
    sees them); its PadLike counts from its own 1, like a Windows gamepad. */
function fromRaw(r: RawStick, first = 0): PadLike {
  const own = r.buttons.map((b) => (first === 0 && b > 44 ? b - 44 : b));
  const n = Math.max(first === 0 && r.buttons.some((b) => b > 44) ? 14 : 44, ...own);
  const down = new Set(own);
  return {
    id: `${r.device} (through T.A.R.G.E.T.)`,
    axes: r.axes,
    buttons: Array.from({ length: n }, (_, i) => ({ pressed: down.has(i + 1) })),
    // T.A.R.G.E.T. reports the hat in hundredths of a degree, -1 when centred
    hat: r.hat === null || r.hat === undefined || r.hat < 0 ? -1 : Math.round(r.hat / 9000) % 4,
  };
}

export function usePads(): Pads {
  const [pads, setPads] = useState<Pads>({ stick: null, throttle: null, combined: null, stickSource: null, frame: 0 });
  const raf = useRef(0);
  const raw = useRef<RawStick | null>(null);
  const rawThr = useRef<RawStick | null>(null);

  // the raw feed: connect (and keep trying until the stick is found)
  useEffect(() => {
    if (!inTauri) return;
    let connected = false;
    let polls = 0;
    const tryStart = () => {
      // once connected, only now and then: the backend also looks for a
      // throttle that joined T.A.R.G.E.T.'s filter late
      if (connected && ++polls % 2) return;
      invoke<{ connected: boolean }>("raw_stick_start")
        .then((s) => {
          connected = s.connected;
          // show the stick straight away, before it first moves
          if (connected) invoke<RawStick | null>("raw_stick_snapshot").then((r) => { if (r && !raw.current) raw.current = r; }).catch(() => {});
          if (connected) invoke<RawStick | null>("raw_throttle_snapshot").then((r) => { if (r && !rawThr.current) rawThr.current = r; }).catch(() => {});
        })
        .catch(() => {});
    };
    tryStart();
    const t = setInterval(tryStart, 3000);
    const off = onEvent<RawStick>("solr:raw-stick", (r) => { raw.current = r; });
    const offThr = onEvent<RawStick>("solr:raw-throttle", (r) => { rawThr.current = r; });
    return () => { clearInterval(t); off(); offThr(); };
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const all = navigator.getGamepads?.() ?? [];
      let winStick: Gamepad | null = null;
      let winThr: Gamepad | null = null;
      let combined: Gamepad | null = null;
      for (const g of all) {
        if (!g) continue;
        if (isStick(g)) winStick = g;
        else if (isThrottle(g)) winThr = g;
        else if (isCombined(g)) combined = g;
      }
      const r = raw.current;
      frame++;
      setPads({
        stick: r ? fromRaw(r) : winStick,
        throttle: rawThr.current ? fromRaw(rawThr.current, 0) : winThr,
        combined,
        stickSource: r ? "target" : winStick ? "windows" : null,
        frame,
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);
  return pads;
}
