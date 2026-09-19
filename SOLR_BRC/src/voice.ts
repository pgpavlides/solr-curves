import { useEffect, useRef, useState } from "react";
import { type LedCmd, ledSet, voiceLoad, voiceSave } from "./bridge";
import type { PadLike } from "./gamepad";

/*
  Voice control, part 1: banks and LEDs.

  The 4-position knob on the Sol-R base reports as buttons 20-23 (exactly one
  is held). Its position is the BANK - later, which set of sounds the pad
  buttons play. For now each bank has a colour, and the eight pad buttons
  (5 6 7 8 / 16 17 18 19) light up in it.

  Sounds: a bank has a folder and a file per pad button. Pressing the pad
  plays it - in Rust (sound.rs), straight from the stick's feed, to the
  VB-CABLE mic and your monitor, the same way the WARDOGS soundboard does.

  LEDs are addressed by "group" (led.rs); which group is which button isn't
  documented. SOLR_LED_MAP is this Sol-R's, found on the real stick with the
  mapping tool (19 Sep 2026): the eight pads are groups 0-7, in their own
  order. `map` in the settings can still override it per button.

  Every other LED on the stick takes the bank colour too.
*/

/** Pad button -> LED group, measured on the stick. */
export const SOLR_LED_MAP: Record<number, number> = { 5: 0, 6: 1, 7: 2, 8: 3, 16: 5, 17: 4, 18: 7, 19: 6 };
/** Groups the whole stick is painted with (the pads are 0-7; the rest are others). */
export const ALL_GROUPS = 64;

export const KNOB = [20, 21, 22, 23];
export const PADS = [5, 6, 7, 8, 16, 17, 18, 19];

export interface Bank {
  name: string;
  color: string;
  /** where this bank's sounds are */
  folder?: string;
  /** pad button -> file in `folder` ("" or missing = silent) */
  pads?: Record<number, string>;
}

export const WARDOGS_SOUNDS = "E:/WARDOGS_SOUNDBOARD";
export interface VoiceConfig {
  banks: Bank[];
  /** button number -> LED group (0-based) */
  map: Record<number, number>;
  /** hold Caps Lock (the game's push-to-talk) while a sound plays; default on */
  ptt?: boolean;
  /** stick button -> a key/wheel sequence the app types (macros.rs) */
  macros?: Record<number, Macro>;
}

export interface Macro {
  /** "F, WheelDown, WheelDown, F, Esc" */
  steps: string;
  /** ms between steps */
  gap: number;
}

export const defaultVoice = (): VoiceConfig => ({
  banks: [
    {
      name: "Bank 1", color: "#39ff6a", folder: WARDOGS_SOUNDS,
      pads: {
        5: "heli_hello.mp3", 6: "heli_can_you_hear_me.mp3", 7: "heli_seatbelt.mp3", 8: "heli_land_on_h.mp3",
        16: "heli_left.mp3", 17: "heli_do_not_follow.mp3", 18: "heli_countdown_ten.mp3", 19: "classic_copy_that.mp3",
      },
    },
    { name: "Bank 2", color: "#2f9bff" },
    { name: "Bank 3", color: "#ffb020" },
    { name: "Bank 4", color: "#ff3fb4" },
  ],
  map: { ...SOLR_LED_MAP },
  macros: { 1: { steps: "F, WheelDown, WheelDown, F, Esc", gap: 120 } },
});

export const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** heli_can_you_hear_me.mp3 -> "Can You Hear Me" (the part before the first _ is its group) */
export function soundLabel(file: string): string {
  const stem = file.replace(/\.[^.]+$/, "");
  const words = stem.split("_");
  return (words.length > 1 ? words.slice(1) : words).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Knob position 0..3 from the pressed buttons, or null when it can't be read. */
export function knobBank(pad: PadLike | null): number | null {
  if (!pad) return null;
  const i = KNOB.findIndex((b) => pad.buttons[b - 1]?.pressed);
  return i >= 0 ? i : null;
}

export function padsTo(cfg: VoiceConfig, color: string): LedCmd[] {
  const [r, g, b] = hexRgb(color);
  return PADS.map((btn) => [cfg.map[btn] ?? SOLR_LED_MAP[btn], r, g, b] as LedCmd);
}

/** Every LED on the stick in one colour (a group that doesn't exist is ignored by the server). */
export function allTo(color: string): LedCmd[] {
  const [r, g, b] = hexRgb(color);
  return Array.from({ length: ALL_GROUPS }, (_, i) => [i, r, g, b] as LedCmd);
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
        if (!(x && Array.isArray(x.banks) && x.map)) return;
        // saved banks over the defaults, so a bank saved before it had sounds gets the default ones
        const d = defaultVoice();
        const next: VoiceConfig = { ...d, ...x, banks: d.banks.map((b, i) => ({ ...b, ...x.banks[i] })), map: { ...SOLR_LED_MAP, ...x.map } };
        setCfg(next);
        // the sound thread plays what the file says: bring it up to date
        if (JSON.stringify(next) !== JSON.stringify(x)) voiceSave(next).catch(() => {});
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
    ledSet(allTo(color)).then(() => setLedError(null)).catch((e) => setLedError(String(e)));
  }, [loaded, hold, bank, cfg]);

  // resend after the mapping tool hands the LEDs back
  useEffect(() => { if (hold) lastSent.current = ""; }, [hold]);

  return { cfg, update, bank, hold, setHold, ledError };
}
