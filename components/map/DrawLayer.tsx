"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import {
  hitStroke,
  newStrokeId,
  pxPerUnit,
  shapePoints,
  strokePath,
  type Pt,
  type Stroke,
  type Tool,
} from "./draw";
import type { Bounds } from "./types";

/*
  The drawing surface.

  Input is taken on the map container rather than on an overlay div, because an
  overlay that swallows pointer events also swallows the wheel, and losing
  scroll-zoom while drawing is worse than anything it buys. Leaflet's own
  dragging is turned off for the duration and the right button pans instead —
  the same arrangement thespires uses.

  The SVG is `pointer-events: none` and is re-projected on every map move, so
  the ink sits on the ground rather than on the glass.
*/

interface Props {
  mapId: string;
  bounds: Bounds;
  active: boolean;
  tool: Tool;
  erasing: boolean;
  color: string;
  /** nib size in screen pixels, at the zoom it is drawn at */
  widthPx: number;
  strokes: Stroke[];
  onCommit: (s: Stroke) => void;
  onErase: (id: string) => void;
}

export default function DrawLayer({
  bounds,
  active,
  tool,
  erasing,
  color,
  widthPx,
  strokes,
  onCommit,
  onErase,
}: Props) {
  const map = useMap();
  const [, bump] = useState(0);
  const [ink, setInk] = useState<Pt[] | null>(null);
  const drawing = useRef(false);
  const anchor = useRef<{ lat: number; lng: number } | null>(null);
  const panFrom = useRef<{ x: number; y: number } | null>(null);

  // re-project on anything that moves the map
  useEffect(() => {
    const redraw = () => bump((n) => n + 1);
    map.on("move zoom zoomend moveend resize viewreset", redraw);
    return () => {
      map.off("move zoom zoomend moveend resize viewreset", redraw);
    };
  }, [map]);

  /*
    While the pen is out, Leaflet must not also be dragging the map — the two
    fight over the same pointer and you get a line and a pan at once.
  */
  useEffect(() => {
    if (!active) return;
    const container = map.getContainer();
    const hadDrag = map.dragging.enabled();
    const hadBox = map.boxZoom.enabled();
    map.dragging.disable();
    map.boxZoom.disable();
    const prevCursor = container.style.cursor;
    container.style.cursor = erasing ? "cell" : "crosshair";
    return () => {
      if (hadDrag) map.dragging.enable();
      if (hadBox) map.boxZoom.enable();
      container.style.cursor = prevCursor;
    };
  }, [map, active, erasing]);

  const at = useCallback(
    (e: PointerEvent) => {
      const p = map.mouseEventToLatLng(e as unknown as MouseEvent);
      return { lat: p.lat, lng: p.lng };
    },
    [map]
  );

  useEffect(() => {
    if (!active) return;
    const container = map.getContainer();

    const down = (e: PointerEvent) => {
      // right button pans, as it does on thespires
      if (e.button === 2) {
        panFrom.current = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      const p = at(e);

      if (erasing) {
        const r = 12 / pxPerUnit(bounds, map.getZoom()); // 12px in game units
        const hit = hitStroke(strokes, p.lat, p.lng, r);
        if (hit) onErase(hit.id);
        e.preventDefault();
        return;
      }

      container.setPointerCapture(e.pointerId);
      drawing.current = true;
      anchor.current = p;
      setInk(tool === "pen" ? [[p.lat, p.lng]] : []);
      e.preventDefault();
    };

    const move = (e: PointerEvent) => {
      if (panFrom.current) {
        const dx = e.clientX - panFrom.current.x;
        const dy = e.clientY - panFrom.current.y;
        panFrom.current = { x: e.clientX, y: e.clientY };
        map.panBy([-dx, -dy], { animate: false });
        return;
      }
      if (!drawing.current || !anchor.current) return;
      const p = at(e);
      if (tool === "pen") {
        setInk((cur) => (cur ? [...cur, [p.lat, p.lng]] : [[p.lat, p.lng]]));
      } else {
        const a = anchor.current;
        const r = Math.hypot(p.lat - a.lat, p.lng - a.lng);
        setInk(shapePoints(tool, a.lat, a.lng, r));
      }
    };

    const up = (e: PointerEvent) => {
      if (panFrom.current) {
        panFrom.current = null;
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {}
        return;
      }
      if (!drawing.current) return;
      drawing.current = false;
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {}
      const pts = ink;
      anchor.current = null;
      setInk(null);
      if (!pts || pts.length < 2) return;
      onCommit({
        id: newStrokeId(),
        points: pts,
        color,
        // px at this zoom -> game units, so it keeps its width on the ground
        width: widthPx / pxPerUnit(bounds, map.getZoom()),
      });
    };

    // the right-button pan needs the browser menu out of the way
    const menu = (e: Event) => e.preventDefault();

    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("pointercancel", up);
    container.addEventListener("contextmenu", menu);
    return () => {
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("pointercancel", up);
      container.removeEventListener("contextmenu", menu);
    };
  }, [map, active, tool, erasing, color, widthPx, bounds, strokes, ink, at, onCommit, onErase]);

  const size = map.getSize();
  const zoom = map.getZoom();
  const scale = pxPerUnit(bounds, zoom);

  const project = (p: Pt): [number, number] => {
    const q = map.latLngToContainerPoint(L.latLng(p[0], p[1]));
    return [q.x, q.y];
  };

  const all = ink && ink.length
    ? [...strokes, { id: "__ink", points: ink, color, width: widthPx / scale }]
    : strokes;

  if (!all.length) return null;

  return (
    <svg className="wm-ink" width={size.x} height={size.y} aria-hidden="true">
      {all.map((s) => (
        <path
          key={s.id}
          d={strokePath(
            s.points.map(project),
            // a line drawn zoomed out would be a thread up close, so the width
            // rides the zoom; the floor keeps it visible when far out
            Math.max(1.2, s.width * scale)
          )}
          fill={s.color}
          opacity={erasing ? 0.55 : 1}
        />
      ))}
    </svg>
  );
}
