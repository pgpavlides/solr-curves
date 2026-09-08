"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { GameMap } from "./types";

/*
  Keyboard control of the map itself.

  Leaflet has its own key handling, but only while the container has focus —
  and on this page focus usually sits on a layer checkbox or the pen tray, so
  in practice the arrows did nothing. These listen on the document instead and
  bow out whenever a field or a button has focus, so typing in the search box
  never pans the map.
*/

/** pixels per press; Shift covers ground faster */
const STEP = 140;

export default function MapKeys({
  game,
  enabled,
}: {
  game: GameMap;
  /** off while a modal-ish surface owns the keyboard */
  enabled: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))
        return;

      const far = e.shiftKey ? 2.5 : 1;
      const pan = (dx: number, dy: number) => {
        e.preventDefault();
        map.panBy([dx * STEP * far, dy * STEP * far], { animate: true });
      };

      /*
        Arrows pan, letters pick tools. WASD is the obvious second pan binding
        and it cannot be had: D is the draw toggle and S is the square, so half
        of WASD would pan and half would not, which is worse than neither.
      */
      switch (e.key) {
        case "ArrowLeft":
          return pan(-1, 0);
        case "ArrowRight":
          return pan(1, 0);
        case "ArrowUp":
          return pan(0, -1);
        case "ArrowDown":
          return pan(0, 1);
        case "+":
        case "=":
          e.preventDefault();
          return void map.zoomIn(e.shiftKey ? 1 : 0.5);
        case "-":
        case "_":
          e.preventDefault();
          return void map.zoomOut(e.shiftKey ? 1 : 0.5);
        case "0":
          e.preventDefault();
          return void map.setView(game.center, game.initialZoom);
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map, game, enabled]);

  return null;
}
