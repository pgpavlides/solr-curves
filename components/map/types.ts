/*
  The shape of public/markers.json.

  Written by hand against the real file rather than generated, so the comments
  can carry what the field names do not say.
*/

export type MapId = "ozeti" | "bakurani";
export const MAP_IDS: MapId[] = ["ozeti", "bakurani"];

export interface Bounds {
  minX: number;
  minY: number;
  /** the world is a square: X spans minX..minX+span, Y spans minY..minY+span */
  span: number;
}

export interface MapMarker {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  /** game-unit Y */
  lat: number;
  /** game-unit X */
  lng: number;
  alt: number | null;
  /*
    On facilities this is "Alpha" / "Bravo" / "Charlie" — a position label on
    the map, NOT one of the three real factions. Never colour a pin from it.
  */
  faction?: string | null;
  parts?: number | null;
  icon: string;
  iconVariant: "pin" | "none";
  bgColor?: string | null;
  scale?: number | null;
  tint?: string | null;
}

export interface MapZone {
  id: string;
  name: string;
  subcategory: string;
  lat: number;
  lng: number;
  color: string;
  polygon: { lat: number; lng: number }[];
}

export interface ControlZonePreset {
  key: string;
  label: string;
  lat: number;
  lng: number;
}

export interface GameMap {
  displayName: string;
  size: number;
  tileSize: number;
  maxZoom: number;
  minZoom: number;
  initialZoom: number;
  bounds: Bounds;
  center: [number, number];
  controlZoneRadius: number;
  controlZones: ControlZonePreset[];
  capturableTowers: string[];
  markers: MapMarker[];
  zones: MapZone[];
}

export interface Legend {
  zoneCategories: Record<string, { color: string }>;
  facilities: Record<string, { label: string; color: string }>;
  worldFeatures: Record<string, { label: string; color: string }>;
  factions: Record<string, { label: string; color: string; icon: string }>;
  labelStyles: {
    settlements: { size: number; fill: string };
    industryTerrain: { size: number; fill: string };
    font: string;
    towerNameplate: { fontSize: number; fill: string; background: string };
  };
  backgroundColor: string;
}

export interface MapData {
  source: string;
  tileStamp: string;
  maps: Record<MapId, GameMap>;
  legend: Legend;
}

/*
  Layer keys are "<category>/<subcategory>" for point markers and
  "zones/<subcategory>" for polygons, so one flat set of strings can drive both
  the panel and the URL.
*/
export const layerKey = (category: string, subcategory: string) =>
  `${category}/${subcategory}`;
export const zoneLayerKey = (subcategory: string) => `zones/${subcategory}`;

/** On by default: tower zones and active towers. Everything else is opt-in. */
export const DEFAULT_ON = new Set([
  zoneLayerKey("towers"),
  layerKey("control-zones", "towers"),
]);

/** Human labels for the two grouping levels the panel renders. */
export const CATEGORY_LABELS: Record<string, string> = {
  "control-zones": "Control Zones",
  facilities: "Faction Bases",
  "world-features": "World Features",
  zones: "Zone Outlines",
};

export const SUBCATEGORY_LABELS: Record<string, string> = {
  towers: "Towers",
  "towers-inactive": "Inactive Towers",
  settlements: "Settlements",
  industry: "Industry & Infrastructure",
  terrain: "Terrain & Landmarks",
};

/**
 * Label for a layer, preferring what legend actually says over our own table.
 * legend covers facilities and world features; zones and towers do not appear
 * there, so those fall back to SUBCATEGORY_LABELS.
 */
export function labelFor(
  legend: Legend,
  category: string,
  subcategory: string
): string {
  if (category === "facilities" && legend.facilities[subcategory])
    return legend.facilities[subcategory].label;
  if (category === "world-features" && legend.worldFeatures[subcategory])
    return legend.worldFeatures[subcategory].label;
  return SUBCATEGORY_LABELS[subcategory] ?? subcategory;
}

/** Swatch colour for a layer row, again from the legend where it exists. */
export function colorFor(
  legend: Legend,
  category: string,
  subcategory: string
): string | null {
  if (category === "zones") return legend.zoneCategories[subcategory]?.color ?? null;
  if (category === "facilities") return legend.facilities[subcategory]?.color ?? null;
  if (category === "world-features")
    return legend.worldFeatures[subcategory]?.color ?? null;
  if (subcategory === "towers-inactive") return "#9F9F9E";
  return null;
}
