/*
  The black-and-white map.

  The tiles are vivid yellow-green terrain and that is CORRECT — there is no
  separate dark or greyscale tile set upstream, and the four plausible CDN paths
  for one all 404. Measured channel means are heavily yellow-biased (Bakurani
  z6 tile 31_27 is R≈172, G≈163, B≈70), which is exactly what desaturating
  neutralises.

  The dark look is three CSS filter functions, in this order, driven by a
  per-map luminance measurement. Constants and the formula are metaforge's,
  from their bundle (chunks/Cb3HSs9n2.js).

  Do not "fix" the tiles.
*/

const TINT_S = 0.238;
const TINT_D = 0.1007;

export interface Tint {
  saturate: number;
  brightness: number;
  contrast: number;
}

/**
 * `pct` 0 = the tiles untouched, 100 = the full dark treatment.
 * At pct 0 this returns the identity filter (1, 1, 1).
 */
export function mapTint(pct: number, meanLuma: number, lumaSd: number): Tint {
  const r = Math.min(100, Math.max(0, pct)) / 100;
  const s = 2 * ((TINT_D * meanLuma) / lumaSd + 0.5 - TINT_S);
  const o = TINT_D / (lumaSd * s);
  return { saturate: 1 - r, brightness: 1 + (o - 1) * r, contrast: 1 + (s - 1) * r };
}

/*
  Per-map luminance, measured by metaforge over their own tiles. These are not
  derivable from markers.json — they are properties of the imagery — so they
  live here rather than in the data file.

  At pct 100 they give, and this is verified against the numbers in their code:
    ozeti     saturate(0) brightness(0.4413) contrast(1.5419)
    bakurani  saturate(0) brightness(0.4557) contrast(1.2629)
*/
export const MAP_LUMA: Record<string, { meanLuma: number; lumaSd: number }> = {
  ozeti: { meanLuma: 0.748, lumaSd: 0.148 },
  bakurani: { meanLuma: 0.642, lumaSd: 0.175 },
};

export const DEFAULT_TINT_PCT = 100;

/** metaforge's own key, so a user with both sites open keeps one setting. */
export const TINT_STORAGE_KEY = "wardogs:map-tint:v3";

export function readStoredTint(): number | null {
  try {
    const raw = window.localStorage.getItem(TINT_STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
  } catch {
    // private mode, blocked storage — the default is fine
    return null;
  }
}

export function storeTint(pct: number) {
  try {
    // We share metaforge's key, so keep their semantics: absent means default.
    // Their own site has no entry until the slider is actually moved.
    if (pct === DEFAULT_TINT_PCT) window.localStorage.removeItem(TINT_STORAGE_KEY);
    else window.localStorage.setItem(TINT_STORAGE_KEY, String(pct));
  } catch {
    /* not worth surfacing */
  }
}

/*
  The three values go onto the document as custom properties and the filter
  itself lives in CSS on `.wm .leaflet-tile-pane` — the TILE PANE ONLY. Put it
  on the map container and the markers, polygons and labels get desaturated
  along with the terrain, which is not what any of this is for.

  metaforge hangs the same filter on `.leaflet-layer` instead, which is a child
  of the tile pane — equivalent for a map with one tile layer. Checked against
  their live page: their <html> carries
    --wd-map-saturate: 0
    --wd-map-brightness: 0.45565858276153537
    --wd-map-contrast: 1.2628502857142858
  on Bakurani, which is what mapTint(100, 0.642, 0.175) returns here.
*/
export function applyTint(mapId: string, pct: number) {
  const luma = MAP_LUMA[mapId];
  if (!luma) return;
  const t = mapTint(pct, luma.meanLuma, luma.lumaSd);
  const root = document.documentElement.style;
  root.setProperty("--wd-map-saturate", String(t.saturate));
  root.setProperty("--wd-map-brightness", String(t.brightness));
  root.setProperty("--wd-map-contrast", String(t.contrast));
}
