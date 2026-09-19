import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SHAPES, type ShapeKind, type Side, defaultSide, sideEvaluator } from "./curve";

/*
  Curve styles: named curve SHAPES, applied to one axis - or one side of it -
  independently of the others. (Presets are whole setups: all three axes.)

  A style is one Side (mode, deadzone, curve, saturation, max output, points,
  smooth). Applying it to a linked axis sets both sides; to a split axis, only
  the side being edited. Saved ones live in hotas_curve_styles.json.

  The picker is a full-window view: every style drawn large, with the curve
  being edited laid faintly over each one to compare against.
*/

export interface Style {
  name: string;
  side: Side;
  note?: string;
  /** filter chip it belongs to: "S-curve", "Expo", ... (user styles: "Yours") */
  group?: string;
  builtin?: boolean;
  savedAt?: string;
}

const s = (over: Partial<Side>): Side => ({ ...defaultSide("roll"), mode: "scurve", deadzone: 0, curve: 0, saturation: 0, outMax: 100, ...over });
const pts = (points: [number, number][]): Side => ({ ...defaultSide("roll"), mode: "points", smooth: true, points });
const sh = (shape: ShapeKind, strength: number, over: Partial<Side> = {}): Side =>
  ({ ...defaultSide("roll"), mode: "shape", shape, strength, deadzone: 1, curve: 0, saturation: 0, outMax: 100, ...over });

export const BUILTIN_STYLES: Style[] = [
  { group: "S-curve", name: "Linear", note: "1:1, no deadzone", side: s({}) },
  { group: "S-curve", name: "Gentle", note: "S 1 · dz 1%", side: s({ curve: 1, deadzone: 1 }) },
  { group: "S-curve", name: "Soft centre", note: "S 2 · dz 2% — the tuned default", side: s({ curve: 2, deadzone: 2 }) },
  { group: "S-curve", name: "Hover precision", note: "S 4 · dz 2%: fine near centre, full at the stop", side: s({ curve: 4, deadzone: 2 }) },
  { group: "S-curve", name: "Very soft", note: "S 7 · dz 3%", side: s({ curve: 7, deadzone: 3 }) },
  { group: "S-curve", name: "Twitchy", note: "S -2 · dz 1%: quick off centre", side: s({ curve: -2, deadzone: 1 }) },
  { group: "S-curve", name: "Big deadzone", note: "linear after 8%", side: s({ deadzone: 8 }) },
  { group: "S-curve", name: "Limited 75%", note: "S 2 · max 75%: never full rate", side: s({ curve: 2, deadzone: 2, outMax: 75 }) },
  { group: "S-curve", name: "Early full", note: "S 1 · full output 10% before the stop", side: s({ curve: 1, deadzone: 1, saturation: 10 }) },

  { group: "Expo", name: "Expo light", note: "expo 25%", side: sh("expo", 25) },
  { group: "Expo", name: "Expo medium", note: "expo 50%: the classic RC setting", side: sh("expo", 50) },
  { group: "Expo", name: "Expo heavy", note: "expo 80%: very calm centre", side: sh("expo", 80, { deadzone: 2 }) },
  { group: "Expo", name: "Expo 75% rate", note: "expo 50% · max 75%", side: sh("expo", 50, { outMax: 75 }) },

  { group: "Power", name: "Square (x²)", note: "power 25%: soft centre, steep end", side: sh("power", 25) },
  { group: "Power", name: "Cube (x³)", note: "power 50%: very soft centre", side: sh("power", 50, { deadzone: 2 }) },

  { group: "Sine", name: "Sine ease", note: "sine 100%: soft centre, near-linear finish", side: sh("sine", 100) },
  { group: "Sine", name: "Sine blend", note: "sine 60%", side: sh("sine", 60) },

  { group: "Smooth S", name: "Smooth S", note: "smoothstep 100%: soft at centre and at the stop", side: sh("smooth", 100, { deadzone: 2 }) },
  { group: "Smooth S", name: "Smooth S light", note: "smoothstep 50%", side: sh("smooth", 50) },

  { group: "Fast start", name: "Fast start", note: "log 50%: quick off centre, calm at the stop", side: sh("faststart", 50) },
  { group: "Fast start", name: "Snappy", note: "log 85%: instant response", side: sh("faststart", 85, { deadzone: 2 }) },

  { group: "Dual rate", name: "Dual rate 30", note: "30% at half stick, then steep", side: sh("dualrate", 30) },
  { group: "Dual rate", name: "Dual rate 20", note: "20% at half stick: precision first half", side: sh("dualrate", 20, { deadzone: 2 }) },

  { group: "Points", name: "Two-stage", note: "points: calm first half, strong second", side: pts([[0, 0], [45, 15], [65, 35], [100, 100]]) },
  { group: "Points", name: "Hover plateau", note: "points: a flat, fine band around hover", side: pts([[0, 0], [8, 3], [30, 8], [55, 25], [100, 100]]) },
];
export const STYLE_GROUPS = ["S-curve", "Expo", "Power", "Sine", "Smooth S", "Fast start", "Dual rate", "Points"];

/** Same shape? Compares only what the side's mode actually uses. */
export const sameShape = (a: Side, b: Side) =>
  a.mode === b.mode && (a.mode === "scurve"
    ? a.deadzone === b.deadzone && a.curve === b.curve && a.saturation === b.saturation && a.outMax === b.outMax
    : a.mode === "shape"
      ? (a.shape ?? "expo") === (b.shape ?? "expo") && (a.strength ?? 40) === (b.strength ?? 40)
        && a.deadzone === b.deadzone && a.saturation === b.saturation && a.outMax === b.outMax
      : a.smooth === b.smooth && JSON.stringify(a.points) === JSON.stringify(b.points));

const pathFor = (side: Side, n = 100) => {
  const f = sideEvaluator(side);
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = -1 + (2 * i) / n;
    const y = Math.sign(x) * f(Math.abs(x));
    d += `${i ? "L" : "M"}${(((x + 1) / 2) * 100).toFixed(2)},${(((1 - y) / 2) * 100).toFixed(2)}`;
  }
  return d;
};

/** A drawing of the full curve (both sides, as if linked), optionally over a faint comparison. */
function Thumb({ side, ghost, size }: { side: Side; ghost?: Side; size?: number }) {
  const d = useMemo(() => pathFor(side), [side]);
  const g = useMemo(() => (ghost ? pathFor(ghost) : null), [ghost]);
  return (
    <svg viewBox="0 0 100 100" className="style-thumb" style={size ? { width: size, height: size } : undefined}>
      {[25, 75].map((v) => (
        <g key={v}>
          <line x1={v} x2={v} y1={0} y2={100} className="st-grid" />
          <line y1={v} y2={v} x1={0} x2={100} className="st-grid" />
        </g>
      ))}
      <line x1={0} y1={100} x2={100} y2={0} className="st-lin" />
      <line x1={50} y1={0} x2={50} y2={100} className="st-ax" />
      <line x1={0} y1={50} x2={100} y2={50} className="st-ax" />
      {g && <path d={g} className="st-ghost" />}
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
  const [group, setGroup] = useState<string>("All");
  const grid = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  const all = [...BUILTIN_STYLES.map((b) => ({ ...b, builtin: true })), ...styles.map((x) => ({ ...x, group: "Yours" }))];
  const groups = ["All", ...STYLE_GROUPS, ...(styles.length ? ["Yours"] : [])];
  const shown = group === "All" ? all : all.filter((x) => x.group === group);

  /*
    Column count that makes the previews as big as possible for however many
    styles are showing, in whatever window: try every count, keep the one
    whose card leaves the largest square for the curve.
  */
  useLayoutEffect(() => {
    const el = grid.current;
    if (!open || !el) return;
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight, n = Math.max(1, shown.length), gap = 12;
      const text = H < 500 ? 34 : 50; // name + note under the curve
      let best = 1, bestSide = 0;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const side = Math.min((W - gap * (c - 1)) / c, (H - gap * (r - 1)) / r - text) - 20;
        if (side > bestSide) { bestSide = side; best = c; }
      }
      setCols(best);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, shown.length]);
  const trimmed = name.trim();
  const clash = all.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !clash?.builtin;
  const save = () => { if (!canSave) return; onSave(clash ? clash.name : trimmed); setName(""); };
  // which style the curve being edited already is, if any
  const matching = all.find((x) => sameShape(x.side, current))?.name;
  const describe = (st: Style) =>
    st.note ?? (st.side.mode === "points" ? `${st.side.points.length} points`
      : st.side.mode === "shape" ? `${SHAPES.find((h) => h.kind === (st.side.shape ?? "expo"))?.label} ${st.side.strength ?? 40}% · dz ${st.side.deadzone}%`
      : `S ${st.side.curve} · dz ${st.side.deadzone}%`);

  return (
    <>
      <button className={`styles-btn ${open ? "on" : ""}`} onClick={() => setOpen(true)}
        title={`${matching ? `Style: ${matching}. ` : ""}Choose a curve style for this axis / side`}>
        <Thumb side={current} size={22} />
        <span>{matching ?? "Styles"}</span>
      </button>

      {open && (
        <div className="styles-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="styles-window" role="dialog" aria-label="Curve styles">
            <div className="styles-top">
              <div className="styles-intro">
                <h2>Curve styles</h2>
                <p className="muted">
                  Click a curve to apply it to <b className="accent">{target}</b>. The faint line is your curve now.
                  Presets (top right) set all three axes at once; styles set one. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.
                </p>
              </div>
              <div className="styles-now">
                <Thumb side={current} size={84} />
                <div>
                  <span className="muted">{target} now</span>
                  <b>{matching ?? "custom curve"}</b>
                </div>
              </div>
              <button className="x styles-close" title="Close (Esc)" onClick={() => setOpen(false)}>×</button>
            </div>

            <div className="styles-chips">
              {groups.map((g) => (
                <button key={g} className={group === g ? "on" : ""} onClick={() => setGroup(g)}>
                  {g} <small>{g === "All" ? all.length : all.filter((x) => x.group === g).length}</small>
                </button>
              ))}
            </div>

            <div className="styles-grid" ref={grid} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {shown.map((st) => (
                <div key={st.name} className={`style-card ${st.name === matching ? "on" : ""}`}>
                  <button className="style-apply" onClick={() => { onApply(st); setOpen(false); }} title={`Apply "${st.name}" to ${target}`}>
                    <Thumb side={st.side} ghost={st.name === matching ? undefined : current} />
                    <span className="style-name">
                      {st.name}
                      {st.name === matching && <span className="tag">current</span>}
                      {!st.builtin && <span className="tag mine">yours</span>}
                    </span>
                    <span className="style-note">{describe(st)}</span>
                  </button>
                  {!st.builtin && (
                    <div className="style-actions">
                      <button className="ghost-btn" title="Save the curve you're editing into this style" onClick={() => onSave(st.name)}>Update</button>
                      <button className={`x ${confirm === st.name ? "confirm" : ""}`} title="Delete style"
                        onClick={() => { if (confirm === st.name) { onDelete(st.name); setConfirm(null); } else setConfirm(st.name); }}>
                        {confirm === st.name ? "Delete?" : "×"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="styles-bottom">
              <div className="presets-save">
                <input placeholder={`Save ${target}'s curve as a new style…`} value={name} maxLength={32}
                  onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
                <button className="add-btn" onClick={save} disabled={!canSave}>{clash && !clash.builtin ? "Overwrite" : "Save style"}</button>
              </div>
              {clash?.builtin && <p className="hint warn">Built-in styles can't be overwritten — pick another name.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
