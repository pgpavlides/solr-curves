"use client";

import {
  CATEGORY_LABELS,
  colorFor,
  labelFor,
  type GameMap,
  type Legend,
} from "./types";

export interface LayerRow {
  key: string;
  category: string;
  subcategory: string;
  count: number;
}

/*
  Only subcategories that actually have something in this map get a row.

  Ozeti genuinely has no facilities, ladders or spawns — its markers[] is four
  towers and nothing else. That is the data, not a gap, so the panel must not
  render checkboxes that can never do anything.
*/
export function buildRows(game: GameMap): LayerRow[] {
  const counts = new Map<string, LayerRow>();
  const bump = (category: string, subcategory: string) => {
    const key = `${category}/${subcategory}`;
    const row = counts.get(key) ?? { key, category, subcategory, count: 0 };
    row.count++;
    counts.set(key, row);
  };
  for (const m of game.markers) bump(m.category, m.subcategory);
  for (const z of game.zones) bump("zones", z.subcategory);
  return [...counts.values()];
}

const ORDER = ["control-zones", "facilities", "world-features", "zones"];

export default function LayerPanel({
  game,
  legend,
  rows,
  active,
  onToggle,
  onAll,
  controlZone,
  onControlZone,
}: {
  game: GameMap;
  legend: Legend;
  rows: LayerRow[];
  active: Set<string>;
  onToggle: (key: string) => void;
  onAll: (on: boolean) => void;
  controlZone: string | null;
  onControlZone: (key: string | null) => void;
}) {
  const groups = ORDER.map((category) => ({
    category,
    rows: rows.filter((r) => r.category === category),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="wm-panel">
      <div className="wm-panel-head">
        <span className="wm-panel-title">Layers</span>
        <span className="wm-panel-acts">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAll(true)}>
            All
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAll(false)}>
            None
          </button>
        </span>
      </div>

      <div className="wm-panel-body">
        {groups.map((g) => (
          <fieldset key={g.category} className="wm-group">
            <legend className="wm-group-title">
              {CATEGORY_LABELS[g.category] ?? g.category}
            </legend>
            {g.rows.map((r) => {
              const color = colorFor(legend, r.category, r.subcategory);
              return (
                <label key={r.key} className="wm-row">
                  <input
                    type="checkbox"
                    checked={active.has(r.key)}
                    onChange={() => onToggle(r.key)}
                  />
                  <span className="wm-swatch" style={color ? { background: color } : undefined}>
                    {!color && (
                      /* towers have an image, not a colour */
                      <img src="/icons/tower.webp" alt="" width={14} height={14} />
                    )}
                  </span>
                  <span className="wm-row-label">
                    {r.category === "zones"
                      ? labelFor(legend, "zones", r.subcategory)
                      : labelFor(legend, r.category, r.subcategory)}
                  </span>
                  <span className="wm-count">{r.count}</span>
                </label>
              );
            })}
          </fieldset>
        ))}

        {game.controlZones.length > 0 && (
          <fieldset className="wm-group">
            <legend className="wm-group-title">Control Zone Preset</legend>
            <label className="wm-select">
              <span className="wm-row-label">
                Radius {game.controlZoneRadius.toLocaleString()} units
              </span>
              <select
                className="wm-sel"
                value={controlZone ?? ""}
                onChange={(e) => onControlZone(e.target.value || null)}
              >
                <option value="">Off</option>
                {game.controlZones.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )}
      </div>
    </div>
  );
}
