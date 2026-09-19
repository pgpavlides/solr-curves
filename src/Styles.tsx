import { useEffect, useMemo, useRef, useState } from "react";
import { type Side, defaultSide, sideEvaluator } from "./curve";

/*
  Curve styles: named curve SHAPES, applied to one axis - or one side of it -
  independently of the others. (Presets are whole setups: all three axes.)

  A style is one Side (mode, deadzone, curve, saturation, max output, points,
  smooth). Applying it to a linked axis sets both sides; to a split axis, only
  the side being edited. Saved ones live in hotas_curve_styles.json.
*/

export interface Style {
  name: string;
  side: Side;
  note?: string;
  builtin?: boolean;
  savedAt?: string;
}

const s = (over: Partial<Side>): Side => ({ ...defaultSide("roll"), mode: "scurve", deadzone: 0, curve: 0, saturation: 0, outMax: 100, ...over });
const pts = (points: [number, number][]): Side => ({ ...defaultSide("roll"), mode: "points", smooth: true, points });

export const BUILTIN_STYLES: Style[] = [
  { name: "Linear", note: "1:1, no deadzone", side: s({}) },
  { name: "Gentle", note: "S 1 · dz 1%", side: s({ curve: 1, deadzone: 1 }) },
  { name: "Soft centre", note: "S 2 · dz 2% — the tuned default", side: s({ curve: 2, deadzone: 2 }) },
  { name: "Hover precision", note: "S 4 · dz 2%: fine near centre, full at the stop", side: s({ curve: 4, deadzone: 2 }) },
  { name: "Very soft", note: "S 7 · dz 3%", side: s({ curve: 7, deadzone: 3 }) },
  { name: "Twitchy", note: "S -2 · dz 1%: quick off centre", side: s({ curve: -2, deadzone: 1 }) },
  { name: "Big deadzone", note: "linear after 8%", side: s({ deadzone: 8 }) },
  { name: "Limited 75%", note: "S 2 · max 75%: never full rate", side: s({ curve: 2, deadzone: 2, outMax: 75 }) },
  { name: "Early full", note: "S 1 · full output 10% before the stop", side: s({ curve: 1, deadzone: 1, saturation: 10 }) },
  { name: "Two-stage", note: "points: calm first half, strong second", side: pts([[0, 0], [45, 15], [65, 35], [100, 100]]) },
];

/** A small drawing of the full curve (both sides, as if linked). */
function Thumb({ side, size = 56 }: { side: Side; size?: number }) {
  const d = useMemo(() => {
    const f = sideEvaluator(side);
    let path = "";
    for (let i = 0; i <= 60; i++) {
      const x = -1 + i / 30;
      const y = Math.sign(x) * f(Math.abs(x));
      path += `${i ? "L" : "M"}${(((x + 1) / 2) * size).toFixed(1)},${(((1 - y) / 2) * size).toFixed(1)}`;
    }
    return path;
  }, [side, size]);
  return (
    <svg width={size} height={size} className="style-thumb">
      <line x1={0} y1={size} x2={size} y2={0} className="st-lin" />
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} className="st-ax" />
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} className="st-ax" />
      <path d={d} className="st-curve" />
    </svg>
  );
}

interface Props {
  styles: Style[];
  current: Side;
  /** "Roll · both sides" / "Pitch · Forward" - where Apply goes */
  target: string;
  onApply: (st: Style) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}

export default function Styles({ styles, current, target, onApply, onSave, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

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

  const all = [...BUILTIN_STYLES.map((b) => ({ ...b, builtin: true })), ...styles];
  const trimmed = name.trim();
  const clash = all.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !clash?.builtin;
  const save = () => { if (!canSave) return; onSave(clash ? clash.name : trimmed); setName(""); };
  // which style the curve being edited already is, if any
  const same = (a: Side, b: Side) =>
    a.mode === b.mode && (a.mode === "scurve"
      ? a.deadzone === b.deadzone && a.curve === b.curve && a.saturation === b.saturation && a.outMax === b.outMax
      : a.smooth === b.smooth && JSON.stringify(a.points) === JSON.stringify(b.points));
  const matching = all.find((x) => same(x.side, current))?.name;

  return (
    <div className="styles" ref={box}>
      <button className={`styles-btn ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} title={`${matching ? `Style: ${matching}. ` : ""}Apply a curve style to this axis / side`}>
        <Thumb side={current} size={22} />
        <span>{matching ?? "Styles"}</span>
        <span className="caret">▾</span>
      </button>

      {open && (
        <div className="styles-pop">
          <div className="styles-head">
            <b>Curve styles</b>
            <span className="muted">apply to <b className="accent">{target}</b></span>
          </div>
          <div className="styles-grid">
            {all.map((st) => (
              <div key={st.name} className={`style-card ${st.name === matching ? "on" : ""}`}>
                <button className="style-apply" onClick={() => { onApply(st); setOpen(false); }} title={`Apply "${st.name}" to ${target}`}>
                  <Thumb side={st.side} />
                  <span className="style-name">{st.name}</span>
                  <span className="style-note">{st.note ?? (st.side.mode === "points" ? `${st.side.points.length} points` : `S ${st.side.curve} · dz ${st.side.deadzone}%`)}</span>
                </button>
                {!st.builtin && (
                  <div className="style-actions">
                    <button className="ghost-btn" title="Save the current curve into this style" onClick={() => onSave(st.name)}>Update</button>
                    <button className={`x ${confirm === st.name ? "confirm" : ""}`} title="Delete style"
                      onClick={() => { if (confirm === st.name) { onDelete(st.name); setConfirm(null); } else setConfirm(st.name); }}>
                      {confirm === st.name ? "Delete?" : "×"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="presets-save">
            <input placeholder="Save the current curve as a style…" value={name} maxLength={32}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
            <button className="add-btn" onClick={save} disabled={!canSave}>{clash && !clash.builtin ? "Overwrite" : "Save style"}</button>
          </div>
          {clash?.builtin && <p className="hint warn">Built-in styles can't be overwritten — pick another name.</p>}
          <p className="hint">Styles set one curve. Presets (top right) set all three axes at once. Ctrl+Z undoes.</p>
        </div>
      )}
    </div>
  );
}
