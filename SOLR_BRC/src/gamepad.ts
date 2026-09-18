import { useEffect, useRef, useState } from "react";

/*
  Live stick reading through the browser Gamepad API.

  Two devices matter: the physical Sol-R (what your hand does) and
  "Thrustmaster Combined" (what the script sends to the game). Plotting both on
  the curve is the proof that the curve on screen is the curve in the game: the
  Combined dot sits ON the line only if the script loaded it.

  Chrome names generic joysticks "<name> (Vendor: 044f Product: 0422)".
  Browsers only list a gamepad after it has been touched while the page is
  open, so nothing shows until the stick moves once.
*/
export interface Pads {
  stick: Gamepad | null;    // Sol-R [R] Flightstick, 044f:0422
  combined: Gamepad | null; // Thrustmaster Combined, 044f:ffff
  frame: number;
}

const isStick = (g: Gamepad) => /044f/i.test(g.id) && /0422/i.test(g.id);
const isCombined = (g: Gamepad) => /044f/i.test(g.id) && /ffff/i.test(g.id) || /combined/i.test(g.id);

export function usePads(): Pads {
  const [pads, setPads] = useState<Pads>({ stick: null, combined: null, frame: 0 });
  const raf = useRef(0);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const all = navigator.getGamepads?.() ?? [];
      let stick: Gamepad | null = null;
      let combined: Gamepad | null = null;
      for (const g of all) {
        if (!g) continue;
        if (isStick(g)) stick = g;
        else if (isCombined(g)) combined = g;
      }
      frame++;
      setPads({ stick, combined, frame });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);
  return pads;
}
