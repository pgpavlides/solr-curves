"use client";

import { COLORS, WIDTHS, type Tool } from "./draw";

/*
  The pen tray. Collapsed to one button until you want it, because most visits
  to a map are to read it, not to mark it up.
*/

const TOOLS: { id: Tool; label: string }[] = [
  { id: "pen", label: "Freehand" },
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
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
    <div className={`wm-draw${open ? " is-open" : ""}`}>
      <button
        type="button"
        className={`btn btn-sm${open ? "" : " btn-ghost"} wm-draw-toggle`}
        onClick={() => onOpen(!open)}
        aria-expanded={open}
      >
        Draw
        {count > 0 && <span className="wm-draw-count">{count}</span>}
      </button>

      {open && (
        <div className="wm-draw-tray" role="toolbar" aria-label="Drawing tools">
          <div className="tabs wm-draw-tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab${tool === t.id && !erasing ? " is-active" : ""}`}
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
              onClick={() => onErasing(!erasing)}
              title="Click a line to remove it"
            >
              Erase
            </button>
          </div>

          <div className="wm-swatches" role="group" aria-label="Colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`wm-swatch-btn${c === color ? " is-active" : ""}`}
                style={{ background: c }}
                aria-label={c}
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
                aria-label={`${w} px`}
                aria-pressed={w === width}
                onClick={() => onWidth(w)}
              >
                <span style={{ width: w + 4, height: w + 4, background: color }} />
              </button>
            ))}
          </div>

          <div className="wm-draw-acts">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onUndo}
              disabled={!canUndo}
            >
              Undo
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onRedo}
              disabled={!canRedo}
            >
              Redo
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onClear}
              disabled={count === 0}
            >
              Clear
            </button>
          </div>

          <p className="wm-draw-hint">
            Left button draws, right button pans. Saved in this browser only.
          </p>
        </div>
      )}
    </div>
  );
}
