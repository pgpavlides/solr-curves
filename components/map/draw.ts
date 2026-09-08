import getStroke from "perfect-freehand";
import type { Bounds } from "./types";

/*
  Drawing on the map.

  Modelled on thespires.gr, with one deliberate difference: theirs is
  collaborative, backed by Supabase realtime and auth. This site is a static
  export with no server and no accounts, so there is nothing to broadcast to.
  What is here is the same drawing — same geometry, same tools, same undo —
  kept in the browser it was drawn in.

  Points are stored in GAME UNITS, not screen pixels, so a line stays on the
  ground it was drawn on however far you pan or zoom. Width is stored in game
  units too, for the same reason: ink on the map, not an overlay on the glass.
*/

/** A point of a stroke, in game units: [lat, lng] — Y then X, as everywhere. */
export type Pt = [number, number];

export interface Stroke {
  id: string;
  points: Pt[];
  color: string;
  /** in game units, so the line keeps its real width as you zoom */
  width: number;
}

/** What the pen draws: a free line, a circle, or a square. */
export type Tool = "pen" | "circle" | "square";

/*
  The game's own colours, so a drawing reads as part of the map rather than on
  top of it: the three faction colours from the legend, the tower gold, and two
  neutrals for everything that is not a side.
*/
export const COLORS = [
  "#FA503E", // Valkyra
  "#4CB1EF", // Lonestar
  "#1DD65C", // Manticore
  "#D8B82E", // tower gold
  "#C98EE0", // violet
  "#FFFFFF", // white
];

/** Nib sizes, in screen pixels at the zoom you draw at. */
export const WIDTHS = [2, 4, 7, 12];

/** Screen pixels per game unit at a given zoom. */
export const pxPerUnit = (bounds: Bounds, zoom: number) =>
  (Math.pow(2, zoom) * 256) / bounds.span;

/*
  A shape's points around a centre.

  Shapes are NOT a separate kind of thing: they are ordinary strokes with
  computed points. That means they go down the same road as anything drawn by
  hand — same storage, same eraser, same undo — and nothing else had to learn
  about them.

  The last segment overlaps the first: the nib thins towards the ends of a
  stroke, so without the overlap there is a visible nick where the shape closes.
*/
export function shapePoints(
  tool: Exclude<Tool, "pen">,
  cLat: number,
  cLng: number,
  r: number
): Pt[] {
  if (tool === "square") {
    const c: Pt[] = [
      [cLat - r, cLng - r],
      [cLat - r, cLng + r],
      [cLat + r, cLng + r],
      [cLat + r, cLng - r],
    ];
    return [...c, c[0], [cLat - r, cLng - r + r * 0.35]];
  }
  const steps = 72;
  const over = 0.14; // radians of overlap
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI * 2 + over);
    out.push([cLat + Math.sin(a) * r, cLng + Math.cos(a) * r]);
  }
  return out;
}

/*
  The outline of a stroke, in screen coordinates.

  A polyline through the raw points comes out angular — you can see where the
  samples are. perfect-freehand builds the outline of a nib instead, and
  `streamline` absorbs the shake of a mouse, so the line comes out curved
  rather than hinged.
*/
export function strokePath(pts: Array<[number, number]>, size: number): string {
  const outline = getStroke(pts, {
    size,
    thinning: 0.35,
    smoothing: 0.6,
    streamline: 0.45,
    simulatePressure: true,
    last: true,
  });
  if (!outline.length) return "";
  const d = outline.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...outline[0], "Q"] as Array<string | number>
  );
  return [...d, "Z"].join(" ");
}

export const newStrokeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `s${Date.now()}${Math.random().toString(16).slice(2)}`;

/* ------------------------------------------------------------- storage */

/*
  Per map, because a drawing of Bakurani means nothing on Ozeti. Versioned in
  the key so a change to the stroke shape can never half-load old data — a
  bumped version simply starts empty.
*/
const key = (mapId: string) => `wardogspilot:map-draw:v1:${mapId}`;

export function loadStrokes(mapId: string): Stroke[] {
  try {
    const raw = window.localStorage.getItem(key(mapId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Stroke =>
        !!s &&
        typeof s === "object" &&
        Array.isArray((s as Stroke).points) &&
        typeof (s as Stroke).color === "string"
    );
  } catch {
    // private mode, blocked storage, or something else wrote to the key
    return [];
  }
}

export function saveStrokes(mapId: string, strokes: Stroke[]) {
  try {
    if (!strokes.length) window.localStorage.removeItem(key(mapId));
    else window.localStorage.setItem(key(mapId), JSON.stringify(strokes));
  } catch {
    /* the drawing still works for this session */
  }
}

/**
 * The stroke nearest a point, for the eraser — or null if nothing is close
 * enough. Distance is measured to the stroke's own points, which is accurate
 * enough at a threshold of a few pixels and costs nothing.
 */
export function hitStroke(
  strokes: Stroke[],
  lat: number,
  lng: number,
  radiusUnits: number
): Stroke | null {
  let best: Stroke | null = null;
  let bestD = radiusUnits * radiusUnits;
  for (const s of strokes) {
    for (const [pLat, pLng] of s.points) {
      const d = (pLat - lat) ** 2 + (pLng - lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
  }
  return best;
}
