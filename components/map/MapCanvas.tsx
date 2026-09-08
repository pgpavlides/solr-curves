"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
/*
  Leaflet's own stylesheet. Imported here rather than in styles/globals.css on
  purpose: globals.css is the single entry for the design system, and this is
  third-party CSS that only the map route needs. Importing it in the component
  keeps it in this route's chunk.
*/
import "leaflet/dist/leaflet.css";

import { makeCRS, worldBounds } from "./crs";
import {
  layerKey,
  zoneLayerKey,
  type ControlZonePreset,
  type GameMap,
  type Legend,
  type MapId,
  type MapMarker,
} from "./types";

export interface View {
  lat: number;
  lng: number;
  zoom: number;
}

interface Props {
  mapId: MapId;
  map: GameMap;
  legend: Legend;
  tileBase: string;
  active: Set<string>;
  controlZone: string | null;
  selectedId: string | null;
  initialView: View | null;
  onSelect: (m: MapMarker | null) => void;
  onView: (v: View) => void;
  onCursor: (p: { lat: number; lng: number } | null) => void;
}

/* ---------------------------------------------------------------- icons */

/*
  The tile set ships three marker images. Every coloured pin is zone.webp
  recoloured, so it is used as a CSS mask and the colour comes from the
  background — no extra image files, and the same webp serves eight legend
  colours.
*/
function pinIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<span class="wm-pin${selected ? " is-selected" : ""}" style="--pin-color:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

function imageIcon(src: string, scale: number, tint: string | null, selected: boolean) {
  const s = Math.round(24 * scale);
  const inner = tint
    ? `<span class="wm-mask" style="--pin-color:${tint};--mask:url(${src})"></span>`
    : `<img src="${src}" alt="" width="${s}" height="${s}" />`;
  return L.divIcon({
    className: "",
    html: `<span class="wm-img${selected ? " is-selected" : ""}" style="width:${s}px;height:${s}px">${inner}</span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

function iconFor(m: MapMarker, selected: boolean) {
  if (m.iconVariant === "pin") return pinIcon(m.bgColor || "#D6D0C2", selected);
  return imageIcon(`/${m.icon}`, m.scale ?? 1, m.tint ?? null, selected);
}

/*
  Tower nameplates, as on the reference render: the name on a dark chip under
  the icon. Style comes from legend.labelStyles.towerNameplate, except the size
  — 30 is the size in the source map's own units and reads enormous on screen,
  so it is scaled to match the reference visually.
*/
function towerPlate(name: string, legend: Legend) {
  const st = legend.labelStyles.towerNameplate;
  return L.divIcon({
    className: "",
    html: `<span class="wm-plate" style="color:${st.fill};background:${st.background}">${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Zone name plates: settlements loud, industry and terrain quiet. */
function labelIcon(name: string, kind: string, legend: Legend) {
  const st =
    kind === "settlements"
      ? legend.labelStyles.settlements
      : legend.labelStyles.industryTerrain;
  return L.divIcon({
    className: "",
    html: `<span class="wm-label" style="font-size:${st.size}px;color:${st.fill}">${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/* -------------------------------------------------------------- plumbing */

/** Reports view changes up, and the cursor position in game units. */
function Reporter({
  onView,
  onCursor,
  onSelect,
}: {
  onView: (v: View) => void;
  onCursor: (p: { lat: number; lng: number } | null) => void;
  onSelect: (m: MapMarker | null) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    },
    zoomend: () => {
      const c = map.getCenter();
      onView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    },
    mousemove: (e) => onCursor({ lat: e.latlng.lat, lng: e.latlng.lng }),
    mouseout: () => onCursor(null),
    click: () => onSelect(null),
  });
  return null;
}

/*
  Switching map changes the CRS, and a Leaflet map cannot have its CRS
  swapped after construction — the MapContainer is keyed by mapId upstream so
  it is torn down and rebuilt. This only fits the world on first mount.
*/
function Framing({ map: game, initialView }: { map: GameMap; initialView: View | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (initialView) {
      map.setView([initialView.lat, initialView.lng], initialView.zoom);
    } else {
      map.setView(game.center, game.initialZoom);
    }
    // the container is sized by CSS; Leaflet needs telling once it has settled
    const t = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(t);
  }, [map, game, initialView]);
  return null;
}

/* ------------------------------------------------------------------ view */

export default function MapCanvas({
  mapId,
  map: game,
  legend,
  tileBase,
  active,
  controlZone,
  selectedId,
  initialView,
  onSelect,
  onView,
  onCursor,
}: Props) {
  const crs = useMemo(() => makeCRS(game.bounds), [game.bounds]);
  const bounds = useMemo(() => worldBounds(game.bounds), [game.bounds]);

  const shownZones = useMemo(
    () => game.zones.filter((z) => active.has(zoneLayerKey(z.subcategory))),
    [game.zones, active]
  );
  const shownMarkers = useMemo(
    () => game.markers.filter((m) => active.has(layerKey(m.category, m.subcategory))),
    [game.markers, active]
  );
  const preset: ControlZonePreset | undefined = useMemo(
    () => game.controlZones.find((c) => c.key === controlZone),
    [game.controlZones, controlZone]
  );

  return (
    <MapContainer
      className="wm-canvas"
      crs={crs}
      center={game.center}
      zoom={game.initialZoom}
      minZoom={game.minZoom}
      maxZoom={game.maxZoom}
      /* config zooms are fractional (2.375 / 2.45); without these Leaflet
         snaps to integers and fights maxBounds on every wheel tick */
      zoomSnap={0.25}
      zoomDelta={0.5}
      maxBounds={bounds}
      maxBoundsViscosity={0.9}
      attributionControl={false}
      /*
        SVG, not canvas. There are at most 60 polygons on a map, so canvas buys
        nothing, and paths keep the zone outlines styleable and inspectable.
      */
    >
      <TileLayer
        url={`${tileBase}/tiles/${mapId}/{z}/{x}_{y}.webp`}
        tileSize={256}
        minZoom={game.minZoom}
        maxZoom={game.maxZoom}
        /* tiles only exist at integer zooms 0..maxZoom; over-zoom re-scales
           the last real level rather than requesting one that 404s */
        maxNativeZoom={game.maxZoom}
        minNativeZoom={0}
        noWrap
        bounds={bounds}
      />

      {/* polygons sit under the markers */}
      {shownZones.map((z) => (
        <Polygon
          key={z.id}
          positions={z.polygon.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: z.color,
            opacity: 0.9,
            weight: 1.5,
            fillColor: z.color,
            fillOpacity: 0.12,
          }}
        />
      ))}

      {shownZones
        .filter((z) => z.subcategory !== "towers")
        .map((z) => (
          <Marker
            key={`${z.id}-label`}
            position={[z.lat, z.lng]}
            icon={labelIcon(z.name, z.subcategory, legend)}
            interactive={false}
            keyboard={false}
          />
        ))}

      {preset && (
        <Circle
          center={[preset.lat, preset.lng]}
          radius={game.controlZoneRadius}
          pathOptions={{
            color: "#D8B82E",
            weight: 1.5,
            opacity: 0.9,
            fillColor: "#D8B82E",
            fillOpacity: 0.08,
          }}
        />
      )}

      {shownMarkers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={iconFor(m, m.id === selectedId)}
          title={m.name}
          alt={m.name}
          eventHandlers={{
            click: (e) => {
              // a marker click is not a map click; keep it from clearing itself
              L.DomEvent.stopPropagation(e);
              onSelect(m);
            },
          }}
        />
      ))}

      {shownMarkers
        .filter((m) => m.subcategory === "towers")
        .map((m) => (
          <Marker
            key={`${m.id}-plate`}
            position={[m.lat, m.lng]}
            icon={towerPlate(m.name, legend)}
            interactive={false}
            keyboard={false}
          />
        ))}

      <Reporter onView={onView} onCursor={onCursor} onSelect={onSelect} />
      <Framing map={game} initialView={initialView} />
    </MapContainer>
  );
}
