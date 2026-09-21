import { useEffect, useRef, useState } from "react";
import { AXES, AXIS_LABEL, type AxisCurve, type AxisName, defaultAxis, migrate } from "./curve";

/*
  Named snapshots of all three axes. Saved to hotas_presets.json next to the
  curve files. A preset holds curve SHAPES: loading one never changes an
  axis's Invert, same rule as copy/paste, so a preset made on a setup where
  pitch is inverted cannot silently un-invert it here.
*/

export type Axes = Record<AxisName, AxisCurve>;

export interface Preset {
  name: string;
  savedAt: string; // ISO
  axes: Axes;
  builtin?: boolean;
}

const linearAxis = (a: AxisName): AxisCurve => {
  const d = defaultAxis(a);
  const s = { ...d.pos, deadzone: 0, curve: 0 };
  return { ...d, pos: s, neg: structuredClone(s) };
};

export const BUILTINS: Preset[] = [
  {
    name: "Default (tuned)",
    savedAt: "",
    builtin: true,
    axes: { roll: defaultAxis("roll"), pitch: defaultAxis("pitch"), yaw: defaultAxis("yaw"), throttle: defaultAxis("throttle") },
  },
  {
    name: "Linear",
    savedAt: "",
    builtin: true,
    axes: { roll: linearAxis("roll"), pitch: linearAxis("pitch"), yaw: linearAxis("yaw"), throttle: linearAxis("throttle") },
  },
];

/** Presets read from disk: drop anything malformed, migrate old curve shapes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cleanPresets(raw: any[]): Preset[] {
  return raw
    .filter((p) => p && typeof p.name === "string" && p.axes)
    .map((p) => ({
      name: p.name,
      savedAt: typeof p.savedAt === "string" ? p.savedAt : "",
      axes: Object.fromEntries(AXES.map((a) => [a, migrate(p.axes[a], a)])) as Axes,
    }));
}

/** Same curves? Invert is not part of a preset, so it is ignored. */
export function sameCurves(a: Axes, b: Axes) {
  const strip = (x: Axes) => AXES.map((k) => ({ ...x[k], invert: false }));
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

function summary(axes: Axes) {
  return AXES.map((a) => {
    const c = axes[a];
    const s = c.pos;
    const t = s.mode === "scurve" ? `S${s.curve} dz${s.deadzone}` : `${s.points.length}pt`;
    return `${AXIS_LABEL[a][0]} ${c.linked ? t : "split"}`;
  }).join(" · ");
}

const when = (iso: string) => {
  if (!iso) return "built-in";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

interface Props {
  presets: Preset[];
  axis: AxisName;
  active: string | null;
  modified: boolean;
  onLoad: (p: Preset, only: AxisName | null) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}

export default function Presets({ presets, axis, active, modified, onLoad, onSave, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // close on Escape or a click outside
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const click = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("mousedown", click);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("mousedown", click); };
  }, [open]);

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  const all = [...BUILTINS, ...presets];
  const trimmed = name.trim();
  const clash = all.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !clash?.builtin;
  const save = () => {
    if (!canSave) return;
    onSave(clash ? clash.name : trimmed);
    setName("");
  };

  return (
    <div className="presets" ref={box}>
      <button className={`presets-btn ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span className="presets-label">Preset</span>
        <b>{active ?? "none"}</b>
        {active && modified && <em>modified</em>}
        <span className="caret">▾</span>
      </button>

      {open && (
        <div className="presets-pop">
          <div className="presets-save">
            <input
              placeholder={active && modified ? `e.g. ${active} v2` : "Name this setup…"}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
            />
            <button className="add-btn" onClick={save} disabled={!canSave}>
              {clash && !clash.builtin ? "Overwrite" : "Save"}
            </button>
          </div>
          {clash?.builtin && <p className="hint warn">Built-in presets can't be overwritten — pick another name.</p>}

          <div className="presets-list">
            {all.map((p) => (
              <div key={p.name} className={`preset ${p.name === active ? "active" : ""}`}>
                <div className="preset-main">
                  <div className="preset-name">
                    {p.name}
                    {p.name === active && <span className="tag">{modified ? "active · modified" : "active"}</span>}
                  </div>
                  <div className="preset-meta">{when(p.savedAt)} · {summary(p.axes)}</div>
                </div>
                <div className="preset-actions">
                  <button className="ghost-btn" onClick={() => { onLoad(p, null); setOpen(false); }}>Load</button>
                  <button className="ghost-btn" title={`Load only ${AXIS_LABEL[axis]} from this preset`}
                    onClick={() => { onLoad(p, axis); setOpen(false); }}>{AXIS_LABEL[axis].replace(/ \(.*\)/, "")} only</button>
                  {!p.builtin && (
                    <>
                      <button className="ghost-btn" title="Save the current curves into this preset" onClick={() => onSave(p.name)}>Update</button>
                      <button className={`x ${confirm === p.name ? "confirm" : ""}`} title="Delete preset"
                        onClick={() => { if (confirm === p.name) { onDelete(p.name); setConfirm(null); } else setConfirm(p.name); }}>
                        {confirm === p.name ? "Delete?" : "×"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="hint">Presets store the curves of all three axes. Invert stays per axis. Loading can be undone with <kbd>Ctrl</kbd>+<kbd>Z</kbd>.</p>
        </div>
      )}
    </div>
  );
}
