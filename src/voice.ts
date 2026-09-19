import { useEffect, useRef, useState } from "react";
import { type LedCmd, ledSet, voiceLoad, voiceSave } from "./bridge";
import type { PadLike } from "./gamepad";

/*
  Voice control, part 1: banks and LEDs.

  The 4-position knob on the Sol-R base reports as buttons 20-23 (exactly one
  is held). Its position is the BANK - later, which set of sounds the pad
  buttons play. For now each bank has a colour, and the eight pad buttons
  (5 6 7 8 / 16 17 18 19) light up in it.

  LEDs are addressed by "group" (led.rs); which group is which button isn't
  documented, so `map` records it (button -> group), found on the real stick
  with the mapping tool. The first guess is group = button - 1.
*/

export const KNOB = [20, 21, 22, 23];
export const PADS = [5, 6, 7, 8, 16, 17, 18, 19];

export interface Bank { name: string; color: string }
export interface VoiceConfig {
  banks: Bank[];
  /** button number -> LED group (0-based) */
  map: Record<number, number>;
}

export const defaultVoice = (): VoiceConfig => ({
  banks: [
    { name: "Bank 1", color: "#39ff6a" },
    { name: "Bank 2", color: "#2f9bff" },
    { name: "Bank 3", color: "#ffb020" },
    { name: "Bank 4", color: "#ff3fb4" },
  ],
  map: Object.fromEntries(PADS.map((b) => [b, b - 1])),
});

export const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Knob position 0..3 from the pressed buttons, or null when it can't be read. */
export function knobBank(pad: PadLike | null): number | null {
  if (!pad) return null;
  const i = KNOB.findIndex((b) => pad.buttons[b - 1]?.pressed);
  return i >= 0 ? i : null;
}

export function padsTo(cfg: VoiceConfig, color: string): LedCmd[] {
  const [r, g, b] = hexRgb(color);
  return PADS.map((btn) => [cfg.map[btn] ?? btn - 1, r, g, b] as LedCmd);
}

/**
  App-wide: loads the settings, follows the knob and recolours the pads
  whenever the bank (or its colour) changes. `hold` pauses it while the
  mapping tool is driving the LEDs itself.
*/
export function useVoiceBanks(stick: PadLike | null) {
  const [cfg, setCfg] = useState<VoiceConfig>(defaultVoice);
  const [loaded, setLoaded] = useState(false);
  const [hold, setHold] = useState(false);
  const [ledError, setLedError] = useState<string | null>(null);
  const bank = knobBank(stick);
  const lastSent = useRef<string>("");

  useEffect(() => {
    voiceLoad()
      .then((v) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x = v as any;
        if (x && Array.isArray(x.banks) && x.map) setCfg({ ...defaultVoice(), ...x });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = (next: VoiceConfig) => {
    setCfg(next);
    voiceSave(next).catch(() => {});
  };

  // push the bank colour to the pads when anything relevant changes
  useEffect(() => {
    if (!loaded || hold || bank === null) return;
    const color = cfg.banks[bank]?.color ?? "#ffffff";
    const key = JSON.stringify([bank, color, cfg.map]);
    if (key === lastSent.current) return;
    lastSent.current = key;
    ledSet(padsTo(cfg, color)).then(() => setLedError(null)).catch((e) => setLedError(String(e)));
  }, [loaded, hold, bank, cfg]);

  // resend after the mapping tool hands the LEDs back
  useEffect(() => { if (hold) lastSent.current = ""; }, [hold]);

  return { cfg, update, bank, hold, setHold, ledError };
}
