/*
  Mossforge in three.js terms.

  The export is still called LUMEN and its keys are still the old token names,
  because every scene reads them by name — the values moved, not the vocabulary.
  What changed is the direction: this was a near-black world lit from below by
  one cool-white key, and it is now a paper world with forest ink on it.

  The aircraft is the darkest object in the scene rather than the lightest,
  which is the whole inversion in one line. `shell` is therefore darker than
  `panel` now, not lighter — on paper a light hull is a flat silhouette for
  exactly the same reason a dark one was on black.
*/
export const LUMEN = {
  void: "#f2efe6",       // paper — the ground the scene sits on
  graphite: "#e6e1d2",   // the deepest paper tone, for the far grid
  panel: "#ffffff",
  slateRise: "#8a9489",
  hairline: "#ddd7c6",
  foreground: "#1a2a22", // pine ink
  muted: "#5a6a60",
  lumen: "#1b342b",      // forest — the strongest ink
  accent: "#c5f26e",     // the one chromatic note; used for the flight path
  /*
    Airframe. Forest, a shade off the darkest ink so the hull reads as a form
    rather than a hole, with a deeper tone for the shaded faces.
  */
  shell: "#2c4a3e",
  shellDark: "#16281f",

  /*
    LIGHTS ARE NOT PALETTE.

    The scene used to colour its lamps with palette tokens, which worked only
    because that palette was pale greys — `muted` and `lumen` were near-white,
    so using them as light colours happened to be fine. Under this palette the
    same tokens are near-black, and a near-black lamp lights nothing: the
    aircraft went almost totally unlit the moment the colours moved.

    So the lamps have their own entries, and they stay light whatever the
    surfaces do.
  */
  lightKey: "#fffdf7",    // warm white, from above
  lightFill: "#eef1ea",   // cool fill
  lightBounce: "#f2efe6", // paper bouncing back up from underneath
} as const;

/** Shared canvas settings so every scene sits in the same material world. */
export const CANVAS_DEFAULTS = {
  dpr: [1, 1.75] as [number, number],
  gl: { antialias: true, alpha: true },
};
