import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Graph, { MIN_GAP } from "./Graph";
import { type PadLike, usePads } from "./gamepad";
import { logLine, stamp } from "./describe";
import TargetPanel, { type Sync } from "./TargetPanel";
import ScriptView from "./ScriptView";
import DevicesView from "./DevicesView";
import Dashboard, { type Page } from "./Dashboard";
import MacrosPage from "./MacrosPage";
import HelpPage from "./HelpPage";
import HornPage from "./HornPage";
import { exportHornSongs } from "./hornSongs";
import RamBadge from "./RamBadge";
import MiniGraph from "./MiniGraph";
import { useVoiceBanks } from "./voice";
import Presets, { BUILTINS, type Preset, cleanPresets, sameCurves } from "./Presets";
import Styles, { type Style } from "./Styles";
import { type GameBindings, emitEvent, fixGameBindings, gameBindings, inTauri, loadPresets, loadState, loadStyles, saveStyles, onEvent, readAck, savePresets, saveState, setOverlay } from "./bridge";
import { type OverlayData, type OverlaySize, overlayWindowSize } from "./Overlay";
import {
  AXES, AXIS_LABEL, ON_THROTTLE, SIDE_LABEL, type AxisCurve, type AxisName, type Pt, type Side, type SideName,
  SHAPES, defaultAxis, evaluator, migrate, scurveToPoints, sideEvaluator, table,
} from "./curve";

interface State {
  axes: Record<AxisName, AxisCurve>;
  /** which Gamepad API axis index carries each control, for the live dots */
  input: Record<AxisName, number>;
}

const initial = (): State => ({
  axes: { roll: defaultAxis("roll"), pitch: defaultAxis("pitch"), yaw: defaultAxis("yaw"), throttle: defaultAxis("throttle") },
  // raw axis numbers: the stick's X, Y and twist (RZ); the throttle's lever is its Z
  input: { roll: 0, pitch: 1, yaw: 5, throttle: 2 },
});

const MAX_POINTS = 10;



/** each axis's colour when all the curves are drawn together */
const AXIS_COLOUR: Record<AxisName, string> = { roll: "#39ff6a", pitch: "#2f9bff", yaw: "#ffb020", throttle: "#ff5fb4" };

export default function App() {
  const [st, setSt] = useState<State>(initial);
  const [axis, setAxis] = useState<AxisName>("roll");
  const [range, setRange] = useState(100);
  /*
    How the curves are shown: "one" - the axis being edited; "overlay" - the
    other two drawn behind it; "split" - all three side by side, each small,
    click one to edit it.
  */
  const [curveView, setCurveView] = useState<"one" | "overlay" | "split">(() => {
    try {
      const v = localStorage.getItem("solr:curveview");
      if (v === "overlay" || v === "split") return v;
      return localStorage.getItem("solr:allcurves") === "1" ? "overlay" : "one";
    } catch { return "one"; }
  });
  useEffect(() => { try { localStorage.setItem("solr:curveview", curveView); } catch { /* private window */ } }, [curveView]);
  const showAll = curveView !== "one";
  // All curves: which of the other axes are hidden (the one being edited always shows)
  const [hidden, setHidden] = useState<AxisName[]>(() => {
    try { return JSON.parse(localStorage.getItem("solr:hiddencurves") ?? "[]"); } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem("solr:hiddencurves", JSON.stringify(hidden)); } catch { /* private window */ } }, [hidden]);
  const toggleHidden = (a: AxisName) => setHidden((h) => (h.includes(a) ? h.filter((x) => x !== a) : [...h, a]));
  const [selected, setSelected] = useState<number | null>(null);
  const [sync, setSync] = useState<Sync>("loading");
  const [gen, setGen] = useState(0);
  const [ack, setAck] = useState<number | null>(null);
  // the real reason a save failed (shown in the badge panel)
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dir, setDir] = useState("C:/SolR/");
  const undo = useRef<State[]>([]);
  const redo = useRef<State[]>([]);
  const loaded = useRef(false);
  const lastSent = useRef<State["axes"] | null>(null);
  // a log line to use instead of the computed diff, for the next write only
  const pendingNote = useRef<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const pads = usePads();
  // the knob picks the bank, the pads light up in its colour - on every page
  const voice = useVoiceBanks(inTauri ? pads.stick : null);

  // Curves (the editor) / Script (any T.A.R.G.E.T. script) / Devices (hardware)
  // the app opens on the dashboard; the logo in the header brings you back to it
  // the built-in horn songs as sound files, for stick buttons (a no-op when nothing changed)
  useEffect(() => { if (inTauri) exportHornSongs().catch(() => {}); }, []);
  const [page, setPage] = useState<"home" | "help" | "horn" | Page>("home");

  const c = st.axes[axis];
  // which side the controls edit. Linked: both, stored on pos and mirrored to neg
  const [view, setView] = useState<SideName>("pos");
  const sv: SideName = c.linked ? "pos" : view;
  const sd = c[sv];

  // ---- load saved state once
  useEffect(() => {
    loadState()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((j: any) => {
        // always set, so the first table is written even with no saved state
        const base = initial();
        if (j.state?.axes) {
          base.axes = Object.fromEntries(AXES.map((a) => [a, migrate(j.state.axes[a], a)])) as State["axes"];
          if (j.state.input) base.input = { ...base.input, ...j.state.input };
        }
        setSt(base);
        if (j.dir) setDir(j.dir);
        loaded.current = true;
        setSync("saving");
      })
      .catch(() => setSync("error"));
  }, []);

  useEffect(() => {
    loadPresets()
      .then((raw) => {
        const list = cleanPresets(raw as never[]);
        setPresets(list);
        const saved = localStorage.getItem("solr:activePreset");
        if (saved) setActivePreset(saved);
      })
      .catch(() => setPresets([]));
  }, []);

  // ---- in-game overlay: on/off, size and opacity survive restarts
  const [ov, setOv] = useState<{ on: boolean; size: OverlaySize; opacity: number }>(() => {
    try {
      return { on: false, size: "M", opacity: 0.85, ...JSON.parse(localStorage.getItem("solr:overlay") ?? "{}") };
    } catch {
      return { on: false, size: "M", opacity: 0.85 };
    }
  });
  useEffect(() => {
    try { localStorage.setItem("solr:overlay", JSON.stringify(ov)); } catch { /* not remembered */ }
  }, [ov]);
  // open / close / resize the window
  useEffect(() => {
    const { width, height } = overlayWindowSize(ov.size);
    setOverlay(ov.on, width, height).catch((e) => setFlash(`Overlay: ${e}`));
  }, [ov.on, ov.size]);
  // what it draws: pushed on every change, and whenever it (re)opens and asks
  const ovData = useRef<OverlayData | null>(null);
  ovData.current = { axes: st.axes, input: st.input, opacity: ov.opacity };
  useEffect(() => {
    if (ov.on) emitEvent("solr:overlay", ovData.current);
  }, [st.axes, st.input, ov.opacity, ov.on]);
  useEffect(() => onEvent("solr:overlay-ready", () => emitEvent("solr:overlay", ovData.current)), []);

  // ---- is WARDOGS actually reading the curves? (see game_bindings in lib.rs)
  const [game, setGame] = useState<GameBindings | null>(null);
  useEffect(() => {
    if (!inTauri) return;
    const check = () => gameBindings().then(setGame).catch(() => {});
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);
  const fixGame = async () => {
    try {
      const n = await fixGameBindings();
      setFlash(n ? `Moved ${n} WARDOGS binding${n > 1 ? "s" : ""} to Thrustmaster Combined` : "Nothing to fix");
      setGame(await gameBindings());
    } catch (e) {
      setFlash(String(e));
    }
  };

  // ---- write tables: debounced, every change goes live
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(async () => {
      const g = Math.floor(Date.now() / 100) % 1_000_000_000;
      // in AXES order - roll, pitch, yaw, throttle - which is how the script reads them
      const tbl = AXES.flatMap((a) => table(st.axes[a]));
      // what changed since the table T.A.R.G.E.T. last got, for its console log
      const note = pendingNote.current ?? logLine(lastSent.current, st.axes);
      setSync("saving");
      try {
        await saveState(st, tbl, g, note);
        lastSent.current = st.axes;
        pendingNote.current = null;
        setGen(g);
        setSaveError(null);
        setSync("waiting");
      } catch (e) {
        setSaveError(String(e));
        setSync("error");
      }
    }, 120);
    return () => clearTimeout(t);
  }, [st]);

  // ---- has the script picked it up?
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        setAck(await readAck());
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
  /*
    Only ever set a state that differs. This used to run every animation
    frame (it keyed on the gamepad frame counter) and call setSync("live")
    even when already live; with the script running that is a state update
    from an effect on every frame, which React reports as "Maximum update
    depth exceeded". The timeout check now runs on its own slow timer.
  */
  useEffect(() => {
    if (!gen) return;
    if (ack === gen) {
      if (sync !== "live") setSync("live");
      return;
    }
    if (sync !== "waiting") return;
    const left = 1500 - (Date.now() - sinceSave.current);
    const t = setTimeout(() => setSync((s) => (s === "waiting" ? "offline" : s)), Math.max(0, left));
    return () => clearTimeout(t);
  }, [ack, gen, sync]);

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

  /** Edit a side. Linked: the change goes to both sides. */
  const setSide = (patch: Partial<Side>, commit = true, side: SideName = sv) =>
    edit((s) => {
      const a = s.axes[axis];
      let next: AxisCurve;
      if (a.linked) {
        const p = { ...a.pos, ...patch };
        next = { ...a, pos: p, neg: structuredClone(p) };
      } else {
        next = { ...a, [side]: { ...a[side], ...patch } };
      }
      return { ...s, axes: { ...s.axes, [axis]: next } };
    }, commit);

  // capped per side so the point table always fits on screen without scrolling
  const onPoints = (pts: Pt[], commit: boolean, side?: SideName) => {
    if (pts.length > MAX_POINTS) return;
    setSide({ points: pts }, commit, side ?? sv);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "text") return;
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

  // ---- live values: the throttle lever is read from the throttle, the rest from the stick
  const handPad = (a: AxisName) => (ON_THROTTLE[a] ? pads.throttle : pads.stick);
  const handOf = (a: AxisName) => handPad(a)?.axes[st.input[a]] ?? null;
  const idx = st.input[axis];
  const stickX = handOf(axis);
  const combinedY = pads.combined ? pads.combined.axes[idx] ?? null : null;
  const f = useMemo(() => evaluator(c), [c]);
  const expected = stickX === null ? null : f(stickX);
  const drift = expected !== null && combinedY !== null ? Math.abs(expected - combinedY) : null;

  const setMode = (mode: Side["mode"]) => {
    if (mode === sd.mode) return;
    // start the custom curve where the curve was, so nothing jumps
    if (mode === "points") setSide({ mode, points: scurveToPoints(sd) });
    else if (mode === "shape") setSide({ mode, shape: sd.shape ?? "expo", strength: sd.strength ?? 40 });
    else setSide({ mode });
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

  /*
    Linked: one curve, mirrored. Picking a side splits them (each starts as
    a copy, so nothing changes until you edit). Re-linking copies the side
    you are looking at onto the other one - undoable, and it says so.
  */
  const other: SideName = sv === "pos" ? "neg" : "pos";
  const chooseSide = (s: SideName | "linked") => {
    setSelected(null);
    if (s === "linked") {
      if (c.linked) return;
      edit((x) => ({ ...x, axes: { ...x.axes, [axis]: { ...c, linked: true, pos: structuredClone(c[sv]), neg: structuredClone(c[sv]) } } }));
      setFlash(`Linked — ${SIDE_LABEL[axis][sv]} copied to ${SIDE_LABEL[axis][other]}`);
      setView("pos");
      return;
    }
    if (c.linked) {
      edit((x) => ({ ...x, axes: { ...x.axes, [axis]: { ...c, linked: false } } }));
      setFlash(`Sides split — editing ${SIDE_LABEL[axis][s]} only`);
    }
    setView(s);
  };
  const onGraphSide = (s: SideName, select: number | null) => {
    setView(s);
    setSelected(select);
  };

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

  // ---- presets
  const storePresets = (list: Preset[]) => {
    setPresets(list);
    savePresets(list).catch(() => setFlash("Couldn't write hotas_presets.json"));
  };
  const markActive = (name: string | null) => {
    setActivePreset(name);
    try {
      if (name) localStorage.setItem("solr:activePreset", name);
      else localStorage.removeItem("solr:activePreset");
    } catch {
      /* storage blocked: the header just forgets the name on restart */
    }
  };
  const savePreset = (name: string) => {
    const p: Preset = { name, savedAt: new Date().toISOString(), axes: structuredClone(st.axes) };
    const exists = presets.some((x) => x.name === name);
    storePresets(exists ? presets.map((x) => (x.name === name ? p : x)) : [...presets, p]);
    markActive(name);
    setFlash(`${exists ? "Updated" : "Saved"} preset "${name}"`);
  };
  const loadPreset = (p: Preset, only: AxisName | null) => {
    const label = (a: AxisName) => AXIS_LABEL[a].replace(/ \(.*\)/, "");
    edit((s) => {
      const axes = { ...s.axes };
      for (const a of only ? [only] : AXES) axes[a] = { ...structuredClone(p.axes[a]), invert: s.axes[a].invert };
      return { ...s, axes };
    });
    setSelected(null);
    pendingNote.current = `${stamp()}  |  Preset "${p.name}" loaded${only ? ` (${label(only)} only)` : ""}`;
    if (!only) markActive(p.name);
    setFlash(only ? `${label(only)} from "${p.name}"` : `Loaded "${p.name}"`);
  };
  const deletePreset = (name: string) => {
    storePresets(presets.filter((x) => x.name !== name));
    if (activePreset === name) markActive(null);
    setFlash(`Deleted "${name}"`);
  };
  // ---- curve styles: one curve shape, applied to this axis / side only
  const [styles, setStyles] = useState<Style[]>([]);
  useEffect(() => {
    loadStyles()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((raw: any[]) => setStyles(raw.filter((x) => x && typeof x.name === "string" && x.side?.mode).map((x) => ({ name: x.name, side: x.side, savedAt: x.savedAt }))))
      .catch(() => setStyles([]));
  }, []);
  const styleTarget = `${AXIS_LABEL[axis].replace(/ \(.*\)/, "")} · ${c.linked ? "both sides" : SIDE_LABEL[axis][sv]}`;
  // for the T.A.R.G.E.T. console, which prints plain ASCII only
  const styleTargetLog = `${AXIS_LABEL[axis].replace(/ \(.*\)/, "")} (${c.linked ? "both sides" : SIDE_LABEL[axis][sv].toLowerCase()})`;
  const applyStyle = (st: Style) => {
    // an S-curve style sets only the S-curve settings; a points style sets the points
    const patch: Partial<Side> = st.side.mode === "scurve"
      ? { mode: "scurve", deadzone: st.side.deadzone, curve: st.side.curve, saturation: st.side.saturation, outMax: st.side.outMax }
      : st.side.mode === "shape"
        ? { mode: "shape", shape: st.side.shape ?? "expo", strength: st.side.strength ?? 40, deadzone: st.side.deadzone, saturation: st.side.saturation, outMax: st.side.outMax }
        : { mode: "points", points: structuredClone(st.side.points), smooth: st.side.smooth };
    setSide(patch);
    setSelected(null);
    pendingNote.current = `${stamp()}  |  Style "${st.name}" -> ${styleTargetLog}`;
    setFlash(`"${st.name}" → ${styleTarget}`);
  };
  const storeStyles = (list: Style[]) => {
    setStyles(list);
    saveStyles(list).catch(() => setFlash("Couldn't write hotas_curve_styles.json"));
  };
  const saveStyle = (name: string) => {
    const st: Style = { name, side: structuredClone(sd), savedAt: new Date().toISOString() };
    const exists = styles.some((x) => x.name === name);
    storeStyles(exists ? styles.map((x) => (x.name === name ? st : x)) : [...styles, st]);
    setFlash(`${exists ? "Updated" : "Saved"} style "${name}"`);
  };
  const deleteStyle = (name: string) => {
    storeStyles(styles.filter((x) => x.name !== name));
    setFlash(`Deleted style "${name}"`);
  };

  const activeP = [...BUILTINS, ...presets].find((p) => p.name === activePreset) ?? null;
  const presetModified = !!activeP && !sameCurves(activeP.axes, st.axes);

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

  // "+ Add": a new point in the middle of the widest gap, ON the current curve,
  // so adding it changes nothing until you move it
  const addPoint = () => {
    if (sd.points.length >= MAX_POINTS) return setFlash(`Maximum ${MAX_POINTS} points per side — remove one first`);
    const pts = [...sd.points].sort((a, b) => a[0] - b[0]);
    let gi = 0;
    for (let i = 1; i < pts.length - 1; i++) if (pts[i + 1][0] - pts[i][0] > pts[gi + 1][0] - pts[gi][0]) gi = i;
    if (pts[gi + 1][0] - pts[gi][0] < MIN_GAP * 2) return setFlash("No room left between points");
    const x = Math.round((pts[gi][0] + pts[gi + 1][0]) * 5) / 10;
    const y = Math.round(sideEvaluator(sd)(x / 100) * 1000) / 10;
    const next = [...pts, [x, y] as Pt].sort((a, b) => a[0] - b[0]);
    onPoints(next, true);
    setSelected(next.findIndex((p) => p[0] === x));
    setFlash(`Added point #${gi + 2} at ${x}%`);
  };

  const sel = selected !== null && sd.mode === "points" ? sd.points[selected] : null;

  const tabInfo = (a: AxisName) => {
    const x = st.axes[a];
    const s = x.pos;
    const t = s.mode === "scurve" ? `S ${s.curve} · dz ${s.deadzone}`
      : s.mode === "shape" ? `${SHAPES.find((h) => h.kind === (s.shape ?? "expo"))?.label} ${s.strength ?? 40}`
      : `${s.points.length} pts`;
    return x.linked ? t : `split · ${t}`;
  };

  return (
    <div className="app">
      <header>
        <div className="brand" role="button" tabIndex={0} title="Dashboard"
          onClick={() => setPage("home")} onKeyDown={(e) => e.key === "Enter" && setPage("home")}>
          <img src="/logo.png" alt="" className="mark" />
          <div>
            <h1>Sol-R Curves</h1>
            <p>WARDOGS · Sol-R [R] Flightstick · live into T.A.R.G.E.T.</p>
          </div>
        </div>
        {inTauri && (
          <nav className="pages">
            {(["curves", "macros", "script", "devices"] as const).map((pg) => (
              <button key={pg} className={page === pg ? "on" : ""} onClick={() => setPage(pg)}>
                {pg === "curves" ? "Curves" : pg === "macros" ? "Macros" : pg === "script" ? "Script" : "Devices"}
              </button>
            ))}
            <button className={page === "horn" ? "on" : ""} onClick={() => setPage("horn")} title="Songs on the helicopter's horn">Horn</button>
            <button className={page === "help" ? "on" : ""} onClick={() => setPage("help")}>Help</button>
          </nav>
        )}
        <div className="header-right">
          {inTauri && (
            <div className={`ov-ctl ${ov.on ? "on" : ""}`}>
              <button className="ov-toggle" onClick={() => setOv((o) => ({ ...o, on: !o.on }))}
                title="Curves and live stick, top-left of the screen, over the game">
                <span className="ov-led" />In-game overlay
              </button>
              {ov.on && (
                <>
                  {(["S", "M", "L"] as OverlaySize[]).map((s) => (
                    <button key={s} className={`ov-size ${ov.size === s ? "on" : ""}`} onClick={() => setOv((o) => ({ ...o, size: s }))}>{s}</button>
                  ))}
                  <input type="range" min={0.3} max={1} step={0.05} value={ov.opacity} title={`Opacity ${Math.round(ov.opacity * 100)}%`}
                    onChange={(e) => setOv((o) => ({ ...o, opacity: Number(e.target.value) }))} />
                </>
              )}
            </div>
          )}
          <Presets
            presets={presets}
            axis={axis}
            active={activeP ? activeP.name : null}
            modified={presetModified}
            onLoad={loadPreset}
            onSave={savePreset}
            onDelete={deletePreset}
          />
          <TargetPanel sync={sync} gen={gen} ack={ack} saveError={saveError} dir={dir} />
        </div>
      </header>

      {inTauri && page === "home" && (
        <Dashboard onOpen={setPage} onHelp={() => setPage("help")} sync={sync} preset={activePreset} stick={pads.stick} cfg={voice.cfg} bank={voice.bank} />
      )}
      {inTauri && page === "horn" && <HornPage />}
      {inTauri && page === "help" && <HelpPage sync={sync} pads={pads} cfg={voice.cfg} />}
      {inTauri && page === "script" && <ScriptView curveScript="hotas_wardogs_solr.tmc" />}
      {inTauri && page === "devices" && <DevicesView />}
      {inTauri && page === "macros" && (
        <MacrosPage stick={pads.stick} throttle={pads.throttle} bank={voice.bank} thrBank={voice.thrBank} cfg={voice.cfg} update={voice.update} setHold={voice.setHold} ledError={voice.ledError} />
      )}
      <main style={inTauri && page !== "curves" ? { display: "none" } : undefined}>
        <section className="left">
          <nav className="tabs">
            {AXES.map((a) => (
              <button key={a} className={a === axis ? "on" : ""} onClick={() => { setAxis(a); setSelected(null); }}>
                {showAll && <i className="tab-swatch" style={{ background: AXIS_COLOUR[a] }} />}
                {AXIS_LABEL[a]}
                <small>{tabInfo(a)}</small>
                {curveView === "overlay" && (
                  a === axis ? (
                    <span className="tab-eye on locked" title="The curve you're editing always shows"><EyeIcon open /></span>
                  ) : (
                    <span role="switch" aria-checked={!hidden.includes(a)} className={`tab-eye ${hidden.includes(a) ? "" : "on"}`}
                      title={hidden.includes(a) ? `Show ${AXIS_LABEL[a]} on the graph` : `Hide ${AXIS_LABEL[a]} from the graph`}
                      onClick={(e) => { e.stopPropagation(); toggleHidden(a); }}>
                      <EyeIcon open={!hidden.includes(a)} />
                    </span>
                  )
                )}
              </button>
            ))}
          </nav>

          <div className="sides">
            <span>Edit</span>
            <button className={c.linked ? "on" : ""} onClick={() => chooseSide("linked")}>Both sides · linked</button>
            <button className={!c.linked && view === "neg" ? "on" : ""} onClick={() => chooseSide("neg")}>− {SIDE_LABEL[axis].neg}</button>
            <button className={!c.linked && view === "pos" ? "on" : ""} onClick={() => chooseSide("pos")}>+ {SIDE_LABEL[axis].pos}</button>
            <div className="curve-views" role="tablist" title="How the curves are shown">
              <button className={curveView === "one" ? "on" : ""} onClick={() => setCurveView("one")}>One</button>
              <button className={curveView === "overlay" ? "on" : ""} onClick={() => setCurveView("overlay")}
                title="All four on one graph, the others dashed behind">All curves</button>
              <button className={curveView === "split" ? "on" : ""} onClick={() => setCurveView("split")}
                title="All four, each on its own graph">Side by side</button>
            </div>
          </div>

          <div className="graph-wrap">
            {game && game.physical.length > 0 && (
              <div className="bind-warn">
                <b>WARDOGS isn't using these curves for {game.physical.join(", ")}.</b>
                <span>
                  {game.physical.length > 1 ? "They are" : "It is"} bound to the physical Sol-R, which bypasses T.A.R.G.E.T.
                  {game.running ? " Close WARDOGS, then fix." : ""}
                </span>
                <button onClick={fixGame} disabled={game.running}
                  title={game.running ? "WARDOGS rewrites its settings when it exits - close it first" : "Rebind them to Thrustmaster Combined (backup kept)"}>
                  {game.running ? "Close WARDOGS to fix" : "Fix bindings"}
                </button>
              </div>
            )}
            {!pads.stick && (
              <p className="graph-note">Move the stick once — browsers only list a joystick after it is touched with the page open.</p>
            )}
            {drift !== null && drift > 0.03 && sync === "live" && (
              <p className="graph-note warn">Game value is off the curve — check this control's input axis under Devices.</p>
            )}
            {curveView === "split" ? (
              <div className="mini-grid">
                {AXES.map((a) => (
                  <MiniGraph key={a} title={AXIS_LABEL[a]} c={st.axes[a]} color={AXIS_COLOUR[a]} range={range}
                    stickX={handOf(a)}
                    combinedY={pads.combined ? pads.combined.axes[st.input[a]] ?? null : null}
                    active={a === axis}
                    onOpen={() => { setAxis(a); setSelected(null); setCurveView("one"); }} />
                ))}
              </div>
            ) : (
            <Graph
              c={c}
              side={sv}
              onSide={onGraphSide}
              range={range}
              stickX={stickX}
              combinedY={combinedY}
              selected={selected}
              maxPoints={MAX_POINTS}
              onNotice={setFlash}
              onSelect={setSelected}
              onPoints={onPoints}
              others={showAll ? AXES.filter((a) => a !== axis && !hidden.includes(a)).map((a) => ({
                name: a, c: st.axes[a], color: AXIS_COLOUR[a],
                // each axis moves on its own curve, read from its own input
                stickX: handOf(a),
                combinedY: pads.combined ? pads.combined.axes[st.input[a]] ?? null : null,
              })) : []}
              color={showAll ? AXIS_COLOUR[axis] : undefined}
            />
            )}
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

          <div className="mode-row">
            <div className="seg">
              <button className={sd.mode === "scurve" ? "on" : ""} onClick={() => setMode("scurve")}>S-curve</button>
              <button className={sd.mode === "shape" ? "on" : ""} onClick={() => setMode("shape")} title="Expo, power, sine, smooth S, fast start, dual rate">Shape</button>
              <button className={sd.mode === "points" ? "on" : ""} onClick={() => setMode("points")} title="Custom points">Points</button>
            </div>
            <Styles styles={styles} current={sd} target={styleTarget} onApply={applyStyle} onSave={saveStyle} onDelete={deleteStyle} />
          </div>

          {sd.mode === "shape" ? (
            <div className="group">
              <div className="shape-kinds">
                {SHAPES.map((s) => (
                  <button key={s.kind} className={(sd.shape ?? "expo") === s.kind ? "on" : ""} onClick={() => setSide({ shape: s.kind })}>
                    {s.label}
                  </button>
                ))}
              </div>
              <Field label="Strength" unit="%" hint={SHAPES.find((s) => s.kind === (sd.shape ?? "expo"))?.strength ?? ""}
                v={sd.strength ?? 40} min={0} max={100} step={0.5} on={(v, k) => setSide({ strength: v }, k)} />
              <Field label="Centre deadzone" unit="%" hint="No output until the stick is this far out"
                v={sd.deadzone} min={0} max={25} step={0.1} on={(v, k) => setSide({ deadzone: v }, k)} />
              <Field label="End saturation" unit="%" hint="Full output this far before the physical end"
                v={sd.saturation} min={0} max={30} step={0.1} on={(v, k) => setSide({ saturation: v }, k)} />
              <Field label="Max output" unit="%" hint="Output at full deflection"
                v={sd.outMax} min={10} max={100} step={0.5} on={(v, k) => setSide({ outMax: v }, k)} />
            </div>
          ) : sd.mode === "scurve" ? (
            <div className="group">
              <Field label="Centre deadzone" unit="%" hint="No output until the stick is this far out"
                v={sd.deadzone} min={0} max={25} step={0.1} on={(v, k) => setSide({ deadzone: v }, k)} />
              <Field label="Curve" unit="" hint="+ softer centre · − twitchier centre"
                v={sd.curve} min={-20} max={20} step={0.1} on={(v, k) => setSide({ curve: v }, k)} />
              <Field label="End saturation" unit="%" hint="Full output this far before the physical end"
                v={sd.saturation} min={0} max={30} step={0.1} on={(v, k) => setSide({ saturation: v }, k)} />
              <Field label="Max output" unit="%" hint="Output at full deflection"
                v={sd.outMax} min={10} max={100} step={0.5} on={(v, k) => setSide({ outMax: v }, k)} />
            </div>
          ) : (
            <div className="group">
              <div className="toggles">
                <label><input type="checkbox" checked={sd.smooth} onChange={(e) => setSide({ smooth: e.target.checked })} /> Smooth</label>
                <button className="ghost-btn" onClick={() => setSide({ points: scurveToPoints(sd) })}>
                  From S-curve
                </button>
              </div>
              <table className="pts">
                <thead><tr><th>#</th><th>Stick %</th><th>Output %</th>
                  <th><button className="add-btn" onClick={addPoint} disabled={sd.points.length >= MAX_POINTS} title="Add a point in the widest gap">+ Add</button></th></tr></thead>
                <tbody>
                  {sd.points.map(([x, y], i) => {
                    const fixedX = i === 0 || i === sd.points.length - 1;
                    return (
                      <tr key={i} className={selected === i ? "sel" : ""} onClick={() => setSelected(i)}>
                        <td>{i + 1}</td>
                        <td>
                          <Num v={x} step={0.1} disabled={fixedX}
                            on={(v) => {
                              const lo = i > 0 ? sd.points[i - 1][0] + 0.1 : 0;
                              const hi = i < sd.points.length - 1 ? sd.points[i + 1][0] - 0.1 : 100;
                              onPoints(sd.points.map((p, j) => (j === i ? [Math.min(hi, Math.max(lo, v)), p[1]] as Pt : p)), true);
                            }} />
                        </td>
                        <td>
                          <Num v={y} step={0.1}
                            on={(v) => onPoints(sd.points.map((p, j) => (j === i ? [p[0], Math.min(100, Math.max(-100, v))] as Pt : p)), true)} />
                        </td>
                        <td>
                          {!fixedX && (
                            <button className="x" title="Remove point"
                              onClick={(e) => { e.stopPropagation(); onPoints(sd.points.filter((_, j) => j !== i), true); setSelected(null); }}>×</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="hint">
                <b>+ Add</b> or double-click empty graph (max {MAX_POINTS}, {MIN_GAP}% apart) · drag, <kbd>Shift</kbd> fine · arrows 0.1 · <kbd>Del</kbd> remove
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
          <PadBars title="Sol-R [R] Flightstick" sub={pads.stickSource === "target" ? "your hand · via T.A.R.G.E.T." : "your hand"} pad={pads.stick} input={st.input} current={axis} only={AXES.filter((a) => !ON_THROTTLE[a])} />
          <PadBars title="Sol-R 6 Throttle" sub={pads.throttle ? "your hand" : "not connected"} pad={pads.throttle} input={st.input} current={axis} only={AXES.filter((a) => ON_THROTTLE[a])} />
          <PadBars title="Thrustmaster Combined" sub="what the game gets" pad={pads.combined} input={st.input} current={axis} />
        </section>
      </main>
      {inTauri && <RamBadge />}
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

function PadBars({ title, sub, pad, input, current, only = AXES }: {
  title: string; sub: string; pad: PadLike | null; input: Record<AxisName, number>; current: AxisName;
  /** the controls this device carries (the stick's, or the throttle's) */
  only?: readonly AxisName[];
}) {
  const tag = (i: number) => only.filter((a) => input[a] === i);
  // Button numbers as Windows (and Thrustmaster's manuals) count them: the
  // Gamepad API's index 0 is button 1. The Sol-R's buttons carry no printed
  // numbers, so this is how you find "button 18" on the real stick.
  const pressed = pad ? pad.buttons.flatMap((b, i) => (b.pressed ? [i + 1] : [])) : [];
  return (
    <div className="pad">
      <div className="pad-title">{title} <em>· {sub}</em></div>
      {pad && (
        <div className="pad-buttons">
          Buttons pressed: <b>{pressed.length ? pressed.join(" + ") : "—"}</b>
        </div>
      )}
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

/** Show / hide, for the All curves toggles. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}
