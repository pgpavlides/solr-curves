"use client";

import { COLORS, WIDTHS, type Tool } from "./draw";

/*
  The pen, laid out inline for the bottom bar rather than as a floating tray.
  Collapsed to one button until you want it: most visits to a map are to read
  it, not to mark it up.

  Every control carries its key in the title, so the shortcuts are discoverable
  from the thing they operate rather than only from the help card.
*/

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "pen", label: "Pen", key: "P" },
  { id: "circle", label: "Circle", key: "C" },
  { id: "square", label: "Square", key: "S" },
];

export default function DrawToolbar({
  open,
  onOpen,
  tool,
  onTool,
  erasing,
  onErasing,
  color,
  onColor,
  width,
  onWidth,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  count,
}: {
  open: boolean;
  onOpen: (v: boolean) => void;
  tool: Tool;
  onTool: (t: Tool) => void;
  erasing: boolean;
  onErasing: (v: boolean) => void;
  color: string;
  onColor: (c: string) => void;
  width: number;
  onWidth: (w: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  count: number;
}) {
  return (
    <div className="wm-draw">
      <button
        type="button"
        className={`btn btn-sm${open ? "" : " btn-ghost"}`}
        onClick={() => onOpen(!open)}
        aria-expanded={open}
        title="Draw (D)"
      >
        Draw
        {count > 0 && <span className="wm-draw-count">{count}</span>}
      </button>

      {open && (
        <div className="wm-draw-row" role="toolbar" aria-label="Drawing tools">
          <div className="tabs">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab${tool === t.id && !erasing ? " is-active" : ""}`}
                title={`${t.label} (${t.key})`}
                onClick={() => {
                  onTool(t.id);
                  onErasing(false);
                }}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              className={`tab${erasing ? " is-active" : ""}`}
              title="Eraser (E) — click a line to remove it"
              onClick={() => onErasing(!erasing)}
            >
              Erase
            </button>
          </div>

          <div className="wm-swatches" role="group" aria-label="Colour">
            {COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                className={`wm-swatch-btn${c === color ? " is-active" : ""}`}
                style={{ background: c }}
                title={`Colour ${i + 1}`}
                aria-label={`Colour ${i + 1}`}
                aria-pressed={c === color}
                onClick={() => {
                  onColor(c);
                  onErasing(false);
                }}
              />
            ))}
          </div>

          <div className="wm-nibs" role="group" aria-label="Line width">
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                className={`wm-nib${w === width ? " is-active" : ""}`}
                title={`Width ${w} — [ and ] to step`}
                aria-label={`Width ${w}`}
                aria-pressed={w === width}
                onClick={() => onWidth(w)}
              >
                <span style={{ width: w + 3, height: w + 3, background: color }} />
              </button>
            ))}
          </div>

          <div className="wm-draw-acts">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onClear}
              disabled={count === 0}
              title="Remove every line"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
