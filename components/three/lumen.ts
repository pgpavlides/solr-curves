/*
  Lumen Edge in three.js terms.

  DESIGN.md is emphatic that hierarchy is luminance, never hue, and that every
  raised surface is lit from a single virtual source below. These scenes honour
  both: one cool-white key from underneath, a dim fill from above, and a palette
  that is entirely greys plus the Lumen highlight.
*/
export const LUMEN = {
  void: "#1b1c22",
  graphite: "#0b151e",
  panel: "#20222a",
  slateRise: "#47515c",
  hairline: "#2f3441",
  foreground: "#ffffff",
  muted: "#a8aebb",
  lumen: "#cfd8e6",
  /*
    Airframe shell. Deliberately lighter than the panel token: on a near-black
    ground a panel-coloured hull renders as a flat silhouette with no form.
    These still sit inside the system's grey ramp, between hairline and muted.
  */
  shell: "#3d4550",
  shellDark: "#272c34",
} as const;

/** Shared canvas settings so every scene sits in the same material world. */
export const CANVAS_DEFAULTS = {
  dpr: [1, 1.75] as [number, number],
  gl: { antialias: true, alpha: true },
};
