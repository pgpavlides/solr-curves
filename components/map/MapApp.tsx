"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "../Logo";
import LayerPanel, { buildRows } from "./LayerPanel";
import {
  DEFAULT_ON,
  MAP_IDS,
  labelFor,
  type MapData,
  type MapId,
  type MapMarker,
} from "./types";
import type { View } from "./MapCanvas";
import {
  DEFAULT_TINT_PCT,
  applyTint,
  readStoredTint,
  storeTint,
} from "./tint";
import DrawToolbar from "./DrawToolbar";
import Shortcuts from "./Shortcuts";
import {
  COLORS,
  WIDTHS,
  loadStrokes,
  saveStrokes,
  type Stroke,
  type Tool,
} from "./draw";

/*
  Leaflet touches window at import time, so the canvas is client-only. This
  module is already a client component, which is what makes ssr:false legal in
  the App Router.
*/
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="wm-loading">Loading map…</div>,
});

const TILE_BASE = (process.env.NEXT_PUBLIC_TILE_BASE ?? "").replace(/\/+$/, "");

/** `?layers=` is a comma list; "-" means "explicitly nothing". */
function encodeLayers(active: Set<string>) {
  return active.size ? [...active].sort().join(",") : "-";
}
function decodeLayers(raw: string | null): Set<string> | null {
  if (raw === null) return null;
  if (raw === "-") return new Set();
  const s = new Set(raw.split(",").filter(Boolean));
  return s.size ? s : new Set();
}

export default function MapApp({ mapId }: { mapId: MapId }) {
  /*
    Fetched rather than imported: see the note in app/map/[mapId]/page.tsx.
    151 KB of JSON in the route's JavaScript would be paid on every visit; as a
    static asset it is cached and parsed once.
  */
  const [data, setData] = useState<MapData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/markers.json")
      .then((r) => {
        if (!r.ok) throw new Error(`markers.json returned ${r.status}`);
        return r.json();
      })
      .then((d: MapData) => live && setData(d))
      .catch((e: unknown) => live && setLoadError(String(e)));
    return () => {
      live = false;
    };
  }, []);

  if (loadError) {
    return (
      <div className="wm-loading wm-loading-error" role="alert">
        Could not load the map data — {loadError}
      </div>
    );
  }
  if (!data) return <div className="wm-loading">Loading map data…</div>;

  return <MapView mapId={mapId} data={data} />;
}

function MapView({ mapId, data }: { mapId: MapId; data: MapData }) {
  const router = useRouter();
  const game = data.maps[mapId];
  const rows = useMemo(() => buildRows(game), [game]);

  /*
    Deliberately NOT seeded from the URL during the first render: reading
    location while rendering makes the server and client disagree. The deep
    link is applied once, after mount, the same way the simulator does it.
  */
  const [active, setActive] = useState<Set<string>>(
    () => new Set([...DEFAULT_ON].filter((k) => rows.some((r) => r.key === k)))
  );
  const [controlZone, setControlZone] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [initialView, setInitialView] = useState<View | null>(null);
  const [hydrated, setHydrated] = useState(false);
  /*
    Not seeded from localStorage during render either — the server has no
    localStorage, so reading it here would be a hydration mismatch. The stored
    value is applied in the same effect that reads the URL.
  */
  const [tint, setTint] = useState(DEFAULT_TINT_PCT);

  /*
    Drawing. thespires keeps its strokes in Supabase and broadcasts them; this
    is a static export with no server, so they live in this browser and are
    loaded after mount, like every other stored value here.
  */
  const [drawOn, setDrawOn] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [erasing, setErasing] = useState(false);
  const [inkColor, setInkColor] = useState(COLORS[0]);
  const [inkWidth, setInkWidth] = useState(WIDTHS[1]);
  /*
    Both stacks in ONE piece of state, on purpose. The obvious version keeps
    them apart and has undo call setUndone from inside the setStrokes updater —
    but an updater must be pure, and React re-invokes it (StrictMode does so
    every time). That pushed the stroke onto the redo stack twice, so a single
    redo brought back two lines. One object, one pure updater, no double.
  */
  const [ink, setInk] = useState<{ done: Stroke[]; undone: Stroke[] }>({
    done: [],
    undone: [],
  });
  const strokes = ink.done;
  const [panelOpen, setPanelOpen] = useState(true);
  const [keysOpen, setKeysOpen] = useState(false);

  // read the shared view out of the URL, once
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const z = Number(q.get("z"));
    const lat = Number(q.get("lat"));
    const lng = Number(q.get("lng"));
    if (Number.isFinite(z) && Number.isFinite(lat) && Number.isFinite(lng) && q.get("z")) {
      setInitialView({ lat, lng, zoom: z });
    }
    const layers = decodeLayers(q.get("layers"));
    if (layers) setActive(new Set([...layers].filter((k) => rows.some((r) => r.key === k))));
    const cz = q.get("cz");
    if (cz && game.controlZones.some((c) => c.key === cz)) setControlZone(cz);
    // a shared link wins over what this browser last chose
    const t = Number(q.get("t"));
    const stored = readStoredTint();
    if (q.get("t") !== null && Number.isFinite(t)) setTint(Math.min(100, Math.max(0, t)));
    else if (stored !== null) setTint(stored);
    setInk({ done: loadStrokes(mapId), undone: [] });
    setHydrated(true);
    // rows/game are stable for a given mapId, which is keyed upstream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ...and write it back as it changes, without touching history
  const write = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (write.current !== null) window.clearTimeout(write.current);
    write.current = window.setTimeout(() => {
      const q = new URLSearchParams();
      if (view) {
        q.set("z", String(Math.round(view.zoom * 100) / 100));
        q.set("lat", String(Math.round(view.lat)));
        q.set("lng", String(Math.round(view.lng)));
      }
      q.set("layers", encodeLayers(active));
      if (controlZone) q.set("cz", controlZone);
      if (tint !== DEFAULT_TINT_PCT) q.set("t", String(tint));
      window.history.replaceState(null, "", `?${q.toString()}`);
    }, 250);
    return () => {
      if (write.current !== null) window.clearTimeout(write.current);
    };
  }, [view, active, controlZone, tint, hydrated]);

  /*
    The filter is set as custom properties on the document rather than as React
    style, so changing it never re-renders the Leaflet tree — dragging the
    slider stays smooth with 101 markers on screen.
  */
  useEffect(() => {
    applyTint(mapId, tint);
  }, [mapId, tint]);

  useEffect(() => {
    if (hydrated) storeTint(tint);
  }, [tint, hydrated]);

  useEffect(() => {
    if (hydrated) saveStrokes(mapId, strokes);
  }, [mapId, strokes, hydrated]);

  // a new line, or a rubbed-out one, ends the redo trail
  const commitStroke = useCallback((s: Stroke) => {
    setInk((cur) => ({ done: [...cur.done, s], undone: [] }));
  }, []);

  const eraseStroke = useCallback((id: string) => {
    setInk((cur) => ({ done: cur.done.filter((s) => s.id !== id), undone: [] }));
  }, []);

  const undo = useCallback(() => {
    setInk((cur) =>
      cur.done.length
        ? {
            done: cur.done.slice(0, -1),
            undone: [...cur.undone, cur.done[cur.done.length - 1]],
          }
        : cur
    );
  }, []);

  const redo = useCallback(() => {
    setInk((cur) =>
      cur.undone.length
        ? {
            done: [...cur.done, cur.undone[cur.undone.length - 1]],
            undone: cur.undone.slice(0, -1),
          }
        : cur
    );
  }, []);

  /*
    App-level keys. Map panning and zooming live in MapKeys, inside the canvas,
    because they need the Leaflet instance; everything here is chrome.

    Anything typed into a field is left alone, so the layer search and the tint
    slider keep working normally.
  */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (typing) return;
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          return setKeysOpen((v) => !v);
        case "Escape":
          if (keysOpen) return setKeysOpen(false);
          if (selected) return setSelected(null);
          if (drawOn) return setDrawOn(false);
          return;
        case "d":
        case "D":
          return setDrawOn((v) => !v);
        case "l":
        case "L":
          return setPanelOpen((v) => !v);
        case "m":
        case "M": {
          const next = MAP_IDS[(MAP_IDS.indexOf(mapId) + 1) % MAP_IDS.length];
          router.push(`/map/${next}/`);
          return;
        }
        case "p":
        case "P":
          setErasing(false);
          return setTool("pen");
        case "c":
        case "C":
          setErasing(false);
          return setTool("circle");
        case "s":
        case "S":
          setErasing(false);
          return setTool("square");
        case "e":
        case "E":
          return setErasing((v) => !v);
        case "[":
          return setInkWidth((w) => WIDTHS[Math.max(0, WIDTHS.indexOf(w) - 1)]);
        case "]":
          return setInkWidth(
            (w) => WIDTHS[Math.min(WIDTHS.length - 1, WIDTHS.indexOf(w) + 1)]
          );
        default:
          if (/^[1-6]$/.test(e.key)) {
            const c = COLORS[Number(e.key) - 1];
            if (c) {
              setErasing(false);
              setInkColor(c);
            }
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapId, router, keysOpen, selected, drawOn, undo, redo]);

  const toggle = useCallback((key: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (on: boolean) => setActive(on ? new Set(rows.map((r) => r.key)) : new Set()),
    [rows]
  );

  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className="wm" style={{ background: data.legend.backgroundColor }}>
      <MapCanvas
        // the CRS cannot be swapped on a live Leaflet map; rebuild it per map
        key={mapId}
        mapId={mapId}
        map={game}
        legend={data.legend}
        tileBase={TILE_BASE}
        active={active}
        controlZone={controlZone}
        selectedId={selected?.id ?? null}
        initialView={initialView}
        onSelect={setSelected}
        onView={setView}
        onCursor={setCursor}
        draw={{
          active: drawOn,
          tool,
          erasing,
          color: inkColor,
          widthPx: inkWidth,
          strokes,
          onCommit: commitStroke,
          onErase: eraseStroke,
        }}
      />

      <header className="wm-bar">
        <Link className="wm-brand" href="/">
          <span className="logo-wrap">
            <Logo />
          </span>
          <span className="wm-brand-text">
            <span className="brand-word">broccolipilot</span>
            <span className="brand-sub">Maps</span>
          </span>
        </Link>
      </header>

      <aside className={`wm-left${panelOpen ? "" : " is-closed"}`}>
        <LayerPanel
          game={game}
          legend={data.legend}
          rows={rows}
          active={active}
          onToggle={toggle}
          onAll={setAll}
          controlZone={controlZone}
          onControlZone={setControlZone}
          tint={tint}
          onTint={setTint}
        />
      </aside>

      {selected && (
        <aside className="wm-detail" role="dialog" aria-label={selected.name}>
          <button
            type="button"
            className="wm-close"
            onClick={() => setSelected(null)}
            aria-label="Close"
          >
            ×
          </button>
          <span className="wm-detail-kicker">
            {labelFor(data.legend, selected.category, selected.subcategory)}
          </span>
          <h2 className="wm-detail-title">{selected.name}</h2>
          <dl className="wm-facts">
            <div>
              <dt>X (lng)</dt>
              <dd>{fmt(selected.lng)}</dd>
            </div>
            <div>
              <dt>Y (lat)</dt>
              <dd>{fmt(selected.lat)}</dd>
            </div>
            <div>
              <dt>Alt</dt>
              <dd>{selected.alt === null ? "—" : fmt(selected.alt)}</dd>
            </div>
            {selected.parts != null && (
              <div>
                <dt>Parts</dt>
                <dd>{selected.parts}</dd>
              </div>
            )}
            {selected.faction && (
              <div>
                <dt>Position</dt>
                {/* Alpha/Bravo/Charlie are map positions, not the three
                    factions, so they are labelled as such and never coloured */}
                <dd>{selected.faction}</dd>
              </div>
            )}
          </dl>
        </aside>
      )}


      {keysOpen && <Shortcuts onClose={() => setKeysOpen(false)} />}

      {/*
        One bar along the bottom: where you are on the left, the pen in the
        middle, where the cursor is on the right.
      */}
      <footer className="wm-dock">
        <div className="wm-dock-left">
          <button
            type="button"
            className={`btn btn-sm${panelOpen ? "" : " btn-ghost"}`}
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            title="Layers (L)"
          >
            Layers
          </button>
          <nav className="wm-maps" aria-label="Map">
            {MAP_IDS.map((id) => (
              <Link
                key={id}
                href={`/map/${id}/`}
                className={`tab${id === mapId ? " is-active" : ""}`}
                aria-current={id === mapId ? "page" : undefined}
                title="Switch map (M)"
              >
                {data.maps[id].displayName}
              </Link>
            ))}
          </nav>
        </div>

        <DrawToolbar
          open={drawOn}
          onOpen={setDrawOn}
          tool={tool}
          onTool={setTool}
          erasing={erasing}
          onErasing={setErasing}
          color={inkColor}
          onColor={setInkColor}
          width={inkWidth}
          onWidth={setInkWidth}
          canUndo={strokes.length > 0}
          canRedo={ink.undone.length > 0}
          onUndo={undo}
          onRedo={redo}
          onClear={() => setInk({ done: [], undone: [] })}
          count={strokes.length}
        />

        <div className="wm-dock-right">
          <div className="wm-readout" aria-live="off">
            <span className="wm-readout-k">X</span>
            <span className="wm-readout-v">{cursor ? fmt(cursor.lng) : "—"}</span>
            <span className="wm-readout-k">Y</span>
            <span className="wm-readout-v">{cursor ? fmt(cursor.lat) : "—"}</span>
            <span className="wm-readout-k">Z</span>
            <span className="wm-readout-v">{view ? view.zoom.toFixed(2) : "—"}</span>
          </div>
          <button
            type="button"
            className={`btn btn-sm${keysOpen ? "" : " btn-ghost"} wm-keys-btn`}
            onClick={() => setKeysOpen((v) => !v)}
            aria-expanded={keysOpen}
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      </footer>

      {!TILE_BASE && (
        <p className="wm-warn">
          <strong>NEXT_PUBLIC_TILE_BASE is not set.</strong> Markers will draw
          but no tiles will load. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code>, then run <code>npm run tiles</code>.
        </p>
      )}
    </div>
  );
}
