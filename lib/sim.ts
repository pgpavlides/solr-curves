import type { Maneuver } from "@/data/maneuvers";
import type { Sampled } from "./sample";

/**
 * The live simulation state.
 *
 * Deliberately a mutable object behind a ref rather than React state: the
 * aircraft and every gauge update at frame rate, and re-rendering the HUD
 * sixty times a second to move a slider dot would be absurd. React owns the
 * things that change when a person clicks; this owns the things that change
 * when time passes.
 */
export interface Sim {
  /** 0..1 through the current maneuver */
  t: number;
  playing: boolean;
  speed: number;
  man: Maneuver;
  frame: Sampled;
  /** seconds parked at the end of a one-shot maneuver before it replays */
  hold: number;
}

export type CamMode = "orbit" | "chase";
