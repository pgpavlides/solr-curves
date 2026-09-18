import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Graph from "./Graph";
import { usePads } from "./gamepad";
import {
  AXES, AXIS_LABEL, type AxisCurve, type AxisName, type Pt,
  defaultAxis, evaluator, foldPoints, mirrorPoints, scurveToPoints, table,
} from "./curve";

interface State {
  axes: Record<AxisName, AxisCurve>;
  /** which Gamepad API axis index carries each control, for the live dots */
  input: Record<AxisName, number>;
}

const initial = (): State => ({
  axes: { roll: defaultAxis("roll"), pitch: defaultAxis("pitch"), yaw: defaultAxis("yaw") },
  input: { roll: 0, pitch: 1, yaw: 5 },
});

const MAX_POINTS = 10;

type Sync = "loading" | "saving" | "waiting" | "live" | "offline" | "error";

export default function App() {
  const [st, setSt] = useState<State>(initial);
  const [axis, setAxis] = useState<AxisName>("roll");
  const [range, setRange] = useState(100);
  const [selected, setSelected] = useState<number | null>(null);
  const [sync, setSync] = useState<Sync>("loading");
  const [gen, setGen] = useState(0);
  const [ack, setAck] = useState<number | null>(null);
  const [dir, setDir] = useState("E:/");
  const undo = useRef<State[]>([]);
  const redo = useRef<State[]>([]);
  const loaded = useRef(false);
  const pads = usePads();

  const c = st.axes[axis];

  // ---- load saved state once
  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((j) => {
        // always set, so the first table is written even with no saved state
        setSt(j.state?.axes ? { ...initial(), ...j.state } : initial());
        if (j.dir) setDir(j.dir);
        loaded.current = true;
        setSync("saving");
      })
      .catch(() => setSync("error"));
  }, []);

  // ---- write tables: debounced, every change goes live
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(async () => {
      const g = Math.floor(Date.now() / 100) % 1_000_000_000;
      const tbl = [...table(st.axes.roll), ...table(st.axes.pitch), ...table(st.axes.yaw)];
      setSync("saving");
      try {
        const r = await fetch("/api/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: st, table: tbl, gen: g }),
        });
        if (!r.ok) throw new Error(await r.text());
        setGen(g);
        setSync("waiting");
      } catch {
        setSync("error");
      }
    }, 120);
    return () => clearTimeout(t);
  }, [st]);

  // ---- has the script picked it up?
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const j = await (await fetch("/api/ack")).json();
        setAck(j.ack);
      } catch {
        /* server restarting */
      }
    }, 300);
    return () => clearInterval(t);
  }, []);

  const sinceSave = useRef(0);
  useEffect(() => {
    if (sync === "waiting") sinceSave.current = Date.now();
  }, [sync, gen]);
  useEffect(() => {
    if (!gen) return;
    if (ack === gen) setSync("live");
    else if (sync === "waiting" && Date.now() - sinceSave.current > 1500) setSync("offline");
  }, [ack, gen, sync, pads.frame]);

  // ---- editing with undo
  // Streaming edits (slider drags, point drags) remember the state they
  // started from; the commit at the end pushes that as ONE undo step.
  const streamBase = useRef<State | null>(null);
  const edit = useCallback((fn: (s: State) => State, commit = true) => {
    setSt((s) => {
      if (!commit) {
        if (!streamBase.current) streamBase.current = s;
      } else {
        undo.current.push(streamBase.current ?? s);
        streamBase.current = null;
        if (undo.current.length > 200) undo.current.shift();
        redo.current = [];
      }
      return fn(s);
    });
  }, []);

  const setAxisCurve = (patch: Partial<AxisCurve>, commit = true) =>
    edit((s) => ({ ...s, axes: { ...s.axes, [axis]: { ...s.axes[axis], ...patch } } }), commit);

  // capped so the point table always fits on screen without scrolling
  const onPoints = (pts: Pt[], commit: boolean) => {
    if (pts.length > MAX_POINTS) return;
    setAxisCurve({ points: pts }, commit);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey && undo.current.length) {
        e.preventDefault();
        setSt((s) => { redo.current.push(s); return undo.current.pop()!; });
      } else if ((e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) && redo.current.length) {
        e.preventDefault();
        setSt((s) => { undo.current.push(s); return redo.current.pop()!; });
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  // ---- live values
  const idx = st.input[axis];
  const stickX = pads.stick ? pads.stick.axes[idx] ?? null : null;
  const combinedY = pads.combined ? pads.combined.axes[idx] ?? null : null;
  const f = useMemo(() => evaluator(c), [c]);
  const expected = stickX === null ? null : f(stickX);
  const drift = expected !== null && combinedY !== null ? Math.abs(expected - combinedY) : null;

  const setMode = (mode: AxisCurve["mode"]) => {
    if (mode === c.mode) return;
    if (mode === "points" && c.mode === "scurve") {
      // start the custom curve where the S-curve was, so nothing jumps
      const pts = scurveToPoints(c).map(([x, y]) => [x, y * c.outMax / 100] as Pt);
      setAxisCurve({ mode, points: c.symmetric ? pts : mirrorPoints(pts) });
    } else setAxisCurve({ mode });
    setSelected(null);
  };

  const setSym = (symmetric: boolean) => {
    setAxisCurve({ symmetric, points: symmetric ? foldPoints(c.points) : mirrorPoints(c.points) });
    setSelected(null);
  };

  /*
    Copying moves the curve SHAPE. Each axis keeps its own Invert, because
    direction belongs to the axis (pitch may need flipping, roll not) and a
    copy that silently reversed a control would be dangerous in flight.
  */
  const [clip, setClip] = useState<{ from: AxisName; curve: AxisCurve } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const shapeOnto = (src: AxisCurve, dst: AxisCurve): AxisCurve => ({
    ...structuredClone(src),
    invert: dst.invert,
  });
  const copyTo = (targets: AxisName[]) => {
    edit((s) => {
      const axes = { ...s.axes };
      for (const to of targets) axes[to] = shapeOnto(s.axes[axis], s.axes[to]);
      return { ...s, axes };
    });
    setFlash(`${AXIS_LABEL[axis]} → ${targets.map((a) => AXIS_LABEL[a]).join(" + ")}`);
  };
  const copyClip = () => {
    setClip({ from: axis, curve: structuredClone(c) });
    setFlash(`Copied ${AXIS_LABEL[axis]}`);
  };
  const pasteClip = () => {
    if (!clip) return;
    setAxisCurve(shapeOnto(clip.curve, c));
    setSelected(null);
    setFlash(`Pasted ${AXIS_LABEL[clip.from]} → ${AXIS_LABEL[axis]}`);
  };

  // Ctrl+C / Ctrl+V copy the whole curve, unless you are typing in a field
  const clipKeys = useRef({ copyClip, pasteClip });
  clipKeys.current = { copyClip, pasteClip };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return;
      if (window.getSelection()?.toString()) return;
      const key = e.key.toLowerCase();
      if (key === "c") { e.preventDefault(); clipKeys.current.copyClip(); }
      if (key === "v") { e.preventDefault(); clipKeys.current.pasteClip(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const sel = selected !== null && c.mode === "points" ? c.points[selected] : null;

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="mark" />
          <div>
            <h1>Sol-R Curves</h1>
            <p>WARDOGS · Sol-R [R] Flightstick · live into T.A.R.G.E.T.</p>
          </div>
        </div>
        <SyncBadge sync={sync} gen={gen} ack={ack} />
      </header>

      <main>
        <section className="left">
          <nav className="tabs">
            {AXES.map((a) => (
              <button key={a} className={a === axis ? "on" : ""} onClick={() => { setAxis(a); setSelected(null); }}>
                {AXIS_LABEL[a]}
                <small>{st.axes[a].mode === "scurve" ? `S ${st.axes[a].curve} · dz ${st.axes[a].deadzone}` : `${st.axes[a].points.length} pts`}</small>
              </button>
            ))}
          </nav>

          <div className="graph-wrap">
            {!pads.stick && (
              <p className="graph-note">Move the stick once — browsers only list a joystick after it is touched with the page open.</p>
            )}
            {drift !== null && drift > 0.03 && sync === "live" && (
              <p className="graph-note warn">Game value is off the curve — check this control's input axis under Devices.</p>
            )}
            <Graph
              c={c}
              range={range}
              stickX={stickX}
              combinedY={combinedY}
              selected={selected}
              maxPoints={MAX_POINTS}
              onSelect={setSelected}
              onPoints={onPoints}
            />
          </div>

          <div className="readout">
            <Readout label="Stick" v={stickX} />
            <Readout label="Curve says" v={expected} />
            <Readout label="Game gets" v={combinedY} warn={drift !== null && drift > 0.03} />
            <div className="legend">
              <span><i className="lg-live" /> your hand → curve</span>
              <span><i className="lg-game" /> Thrustmaster Combined</span>
              <span className="zoom">
                View
                {[100, 50, 25, 10].map((r) => (
                  <button key={r} className={r === range ? "on" : ""} onClick={() => setRange(r)}>±{r}%</button>
                ))}
              </span>
            </div>
          </div>
        </section>

        <section className="right">
          <div className="copy">
            <div className="copy-row">
              <span className="copy-label">Copy {AXIS_LABEL[axis]} to</span>
              {AXES.filter((a) => a !== axis).map((a) => (
                <button key={a} className="ghost-btn" onClick={() => copyTo([a])}>{AXIS_LABEL[a]}</button>
              ))}
              <button className="ghost-btn" onClick={() => copyTo(AXES.filter((a) => a !== axis))}>Both</button>
            </div>
            <div className="copy-row">
              <button className="ghost-btn" onClick={copyClip} title="Ctrl+C">Copy curve</button>
              <button className="ghost-btn" onClick={pasteClip} disabled={!clip} title="Ctrl+V">
                Paste{clip ? ` ${AXIS_LABEL[clip.from]}` : ""}
              </button>
              <span className={`copy-flash ${flash ? "on" : ""}`}>{flash ?? "Invert stays per axis"}</span>
            </div>
          </div>

          <div className="seg">
            <button className={c.mode === "scurve" ? "on" : ""} onClick={() => setMode("scurve")}>S-curve</button>
            <button className={c.mode === "points" ? "on" : ""} onClick={() => setMode("points")}>Custom points</button>
          </div>

          {c.mode === "scurve" ? (
            <div className="group">
              <Field label="Centre deadzone" unit="%" hint="No output until the stick is this far out"
                v={c.deadzone} min={0} max={25} step={0.1} on={(v, k) => setAxisCurve({ deadzone: v }, k)} />
              <Field label="Curve" unit="" hint="+ softer centre · − twitchier centre"
                v={c.curve} min={-20} max={20} step={0.1} on={(v, k) => setAxisCurve({ curve: v }, k)} />
              <Field label="End saturation" unit="%" hint="Full output this far before the physical end"
                v={c.saturation} min={0} max={30} step={0.1} on={(v, k) => setAxisCurve({ saturation: v }, k)} />
              <Field label="Max output" unit="%" hint="Output at full deflection"
                v={c.outMax} min={10} max={100} step={0.5} on={(v, k) => setAxisCurve({ outMax: v }, k)} />
            </div>
          ) : (
            <div className="group">
              <div className="toggles">
                <label><input type="checkbox" checked={c.symmetric} onChange={(e) => setSym(e.target.checked)} /> Symmetric</label>
                <label><input type="checkbox" checked={c.smooth} onChange={(e) => setAxisCurve({ smooth: e.target.checked })} /> Smooth</label>
                <button className="ghost-btn" onClick={() => setAxisCurve({ points: c.symmetric ? scurveToPoints(c) : mirrorPoints(scurveToPoints(c)) })}>
                  From S-curve
                </button>
              </div>
              <table className="pts">
                <thead><tr><th>#</th><th>Stick %</th><th>Output %</th><th /></tr></thead>
                <tbody>
                  {c.points.map(([x, y], i) => {
                    const fixedX = i === 0 || i === c.points.length - 1;
                    return (
                      <tr key={i} className={selected === i ? "sel" : ""} onClick={() => setSelected(i)}>
                        <td>{i + 1}</td>
                        <td>
                          <Num v={x} step={0.1} disabled={fixedX}
                            on={(v) => {
                              const lo = i > 0 ? c.points[i - 1][0] + 0.1 : -100;
                              const hi = i < c.points.length - 1 ? c.points[i + 1][0] - 0.1 : 100;
                              onPoints(c.points.map((p, j) => (j === i ? [Math.min(hi, Math.max(lo, v)), p[1]] as Pt : p)), true);
                            }} />
                        </td>
                        <td>
                          <Num v={y} step={0.1}
                            on={(v) => onPoints(c.points.map((p, j) => (j === i ? [p[0], Math.min(100, Math.max(-100, v))] as Pt : p)), true)} />
                        </td>
                        <td>
                          {!fixedX && (
                            <button className="x" title="Remove point"
                              onClick={(e) => { e.stopPropagation(); onPoints(c.points.filter((_, j) => j !== i), true); setSelected(null); }}>×</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="hint">
                Double-click graph: add (max {MAX_POINTS}) · drag, <kbd>Shift</kbd> fine · arrows 0.1 · <kbd>Del</kbd> remove
                {sel && <> · #{selected! + 1}: {sel[0]}% → {sel[1]}%</>}
              </p>
            </div>
          )}

          <div className="bottom">
          <div className="group">
            <label className="check">
              <input type="checkbox" checked={c.invert} onChange={(e) => setAxisCurve({ invert: e.target.checked })} />
              Invert this axis
            </label>
          </div>

          <div className="group row">
            <button className="ghost-btn" onClick={() => edit((s) => ({ ...s, axes: { ...s.axes, [axis]: defaultAxis(axis) } }))}>
              Reset {AXIS_LABEL[axis]}
            </button>
          </div>

          <p className="foot">
            Writes <code>{dir}hotas_curves.txt</code> · live within ¼ s · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> curve
          </p>
          </div>
        </section>

        <section className="side">
          <h2>Devices</h2>
          <p className="hint">Which input axis each control reads — for the live dots only.</p>
          <div className="axis-pick">
            {AXES.map((a) => (
              <label key={a} className={a === axis ? "on" : ""}>
                <span>{AXIS_LABEL[a]}</span>
                <select value={st.input[a]} onChange={(e) => setSt((s) => ({ ...s, input: { ...s.input, [a]: Number(e.target.value) } }))}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>#{i}</option>)}
                </select>
              </label>
            ))}
          </div>
          <PadBars title="Sol-R [R] Flightstick" sub="your hand" pad={pads.stick} input={st.input} current={axis} />
          <PadBars title="Thrustmaster Combined" sub="what the game gets" pad={pads.combined} input={st.input} current={axis} />
        </section>
      </main>
    </div>
  );
}

function SyncBadge({ sync, gen, ack }: { sync: Sync; gen: number; ack: number | null }) {
  const text: Record<Sync, string> = {
    loading: "Loading…",
    saving: "Saving…",
    waiting: "Waiting for the script…",
    live: "Live in T.A.R.G.E.T.",
    offline: ack === null ? "Script has never loaded a table — is it running?" : "Saved — script not picking it up. Is it running?",
    error: "Can't reach the dev server",
  };
  return (
    <div className={`sync ${sync}`} title={`table #${gen} · script has #${ack ?? "none"}`}>
      <span className="dot" />
      {text[sync]}
    </div>
  );
}

function Readout({ label, v, warn }: { label: string; v: number | null; warn?: boolean }) {
  return (
    <div className={`ro ${warn ? "warn" : ""}`}>
      <span>{label}</span>
      <b>{v === null ? "—" : `${(v * 100).toFixed(1)}%`}</b>
    </div>
  );
}

function PadBars({ title, sub, pad, input, current }: {
  title: string; sub: string; pad: Gamepad | null; input: Record<AxisName, number>; current: AxisName;
}) {
  const tag = (i: number) => AXES.filter((a) => input[a] === i);
  return (
    <div className="pad">
      <div className="pad-title">{title} <em>· {sub}</em></div>
      {!pad && <div className="pad-empty">Not seen yet — move it once.</div>}
      {pad && pad.axes.slice(0, 10).map((raw, i) => {
        const tags = tag(i);
        const v = Math.max(-1, Math.min(1, raw)); // some axes (hats, dials) report past ±1
        return (
          <div key={i} className={`bar ${tags.includes(current) ? "cur" : tags.length ? "used" : ""}`}>
            <span>#{i}</span>
            <div className="track"><div className="fill" style={{ left: `${Math.min(50, 50 + v * 50)}%`, width: `${Math.abs(v * 50)}%` }} /></div>
            <code>{(raw * 100).toFixed(0)}</code>
            <b>{tags.map((a) => AXIS_LABEL[a][0]).join("")}</b>
          </div>
        );
      })}
    </div>
  );
}

/*
  Slider + exact number. Slider drags stream without undo entries; release,
  typing and the step buttons commit.
*/
function Field({ label, unit, hint, v, min, max, step, on }: {
  label: string; unit: string; hint: string; v: number; min: number; max: number; step: number;
  on: (v: number, commit: boolean) => void;
}) {
  const clamp = (x: number) => Math.round(Math.min(max, Math.max(min, x)) / step) * step;
  const fix = (x: number) => Number(clamp(x).toFixed(3));
  return (
    <div className="field">
      <div className="field-head">
        <label>{label}</label>
        <div className="num-wrap">
          <button onClick={() => on(fix(v - step), true)}>−</button>
          <Num v={v} step={step} on={(x) => on(fix(x), true)} />
          <span className="unit">{unit}</span>
          <button onClick={() => on(fix(v + step), true)}>+</button>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => on(fix(Number(e.target.value)), false)}
        onPointerUp={(e) => on(fix(Number((e.target as HTMLInputElement).value)), true)} />
      <p className="hint">{hint}</p>
    </div>
  );
}

/** Number input that only commits on Enter / blur, so typing "-1" isn't applied as "-". */
function Num({ v, step, on, disabled }: { v: number; step: number; on: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n)) on(n);
    setDraft(null);
  };
  return (
    <input
      className="num"
      type="number"
      step={step}
      disabled={disabled}
      value={draft ?? String(Number(v.toFixed(3)))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setDraft(null); }}
    />
  );
}
