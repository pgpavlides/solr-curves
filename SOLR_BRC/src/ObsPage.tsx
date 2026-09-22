import { useEffect, useMemo, useState } from "react";
import { obsPort } from "./bridge";
import { AXES, AXIS_LABEL, type AxisName } from "./curve";

/*
  OBS overlays: one web page per axis, served by the app itself (obs.rs), so
  OBS can show each curve as a Browser Source. The look is written into the
  link as query parameters, so nothing has to be set up twice - copy the link,
  paste it into OBS, done.
*/

const DEFAULT_COLOUR: Record<AxisName, string> = {
  roll: "#39ff6a", pitch: "#2f9bff", yaw: "#ffb020", throttle: "#ff5fb4",
};

interface Style {
  w: number;
  h: number;
  bg: string;          // "" = transparent
  line: number;
  glow: number;
  pad: number;
  round: number;
  grid: boolean;
  gridcolor: string;
  gridalpha: number;
  ideal: boolean;
  dot: boolean;
  dotcolor: string;
  dotsize: number;
  guide: boolean;
  label: boolean;
  nums: boolean;
  fade: boolean;
}

const DEFAULTS: Style = {
  w: 420, h: 300, bg: "", line: 3, glow: 8, pad: 10, round: 0,
  grid: true, gridcolor: "#ffffff", gridalpha: 0.14, ideal: true,
  dot: true, dotcolor: "#ffffff", dotsize: 7, guide: true,
  label: true, nums: true, fade: false,
};

const KEY = "solr:obsstyle";

export default function ObsPage() {
  const [port, setPort] = useState(0);
  const [style, setStyle] = useState<Style>(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULTS; }
  });
  const [colours, setColours] = useState<Record<AxisName, string>>(() => {
    try { return { ...DEFAULT_COLOUR, ...JSON.parse(localStorage.getItem(KEY + ":colours") ?? "{}") }; } catch { return DEFAULT_COLOUR; }
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [preview, setPreview] = useState<AxisName>("roll");
  const [nonce, setNonce] = useState(0); // reload the preview after a change

  useEffect(() => { obsPort().then(setPort).catch(() => setPort(0)); }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(style)); } catch { /* not remembered */ } }, [style]);
  useEffect(() => { try { localStorage.setItem(KEY + ":colours", JSON.stringify(colours)); } catch { /* not remembered */ } }, [colours]);
  useEffect(() => { const t = setTimeout(() => setNonce((n) => n + 1), 250); return () => clearTimeout(t); }, [style, colours]);

  const set = <K extends keyof Style>(k: K, v: Style[K]) => setStyle((s) => ({ ...s, [k]: v }));

  /** only what differs from the page's own defaults, so links stay readable */
  const url = useMemo(() => (axis: AxisName) => {
    const q = new URLSearchParams();
    const colour = colours[axis] ?? DEFAULT_COLOUR[axis];
    if (colour.toLowerCase() !== DEFAULT_COLOUR[axis]) q.set("color", colour.replace("#", ""));
    if (style.bg) q.set("bg", style.bg.replace("#", ""));
    if (style.line !== DEFAULTS.line) q.set("line", String(style.line));
    if (style.glow !== DEFAULTS.glow) q.set("glow", String(style.glow));
    if (style.pad !== DEFAULTS.pad) q.set("pad", String(style.pad));
    if (style.round !== DEFAULTS.round) q.set("round", String(style.round));
    if (!style.grid) q.set("grid", "0");
    if (style.gridcolor !== DEFAULTS.gridcolor) q.set("gridcolor", style.gridcolor.replace("#", ""));
    if (style.gridalpha !== DEFAULTS.gridalpha) q.set("gridalpha", String(style.gridalpha));
    if (!style.ideal) q.set("ideal", "0");
    if (!style.dot) q.set("dot", "0");
    if (style.dotcolor !== DEFAULTS.dotcolor) q.set("dotcolor", style.dotcolor.replace("#", ""));
    if (style.dotsize !== DEFAULTS.dotsize) q.set("dotsize", String(style.dotsize));
    if (!style.guide) q.set("guide", "0");
    if (!style.label) q.set("label", "0");
    if (!style.nums) q.set("nums", "0");
    if (style.fade) q.set("fade", "1");
    const s = q.toString();
    return `http://127.0.0.1:${port}/${axis}${s ? `?${s}` : ""}`;
  }, [port, style, colours]);

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* the box is selectable as a fallback */ }
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
  };

  return (
    <div className="obs">
      <div className="obs-inner">
        <div className="obs-head">
          <h1>OBS overlays</h1>
          <p>
            One page per axis, served by this app on your own machine. In OBS: <b>+ → Browser</b>, paste the link, set the
            size, and tick <b>Shutdown source when not visible</b> if you like. The background is transparent.
          </p>
          {port === 0 && <p className="hint warn">The overlay server isn't running - restart the app.</p>}
        </div>

        <div className="obs-grid">
          <section className="vv-panel obs-links">
            <h2>The links</h2>
            {AXES.map((a) => (
              <div key={a} className={`obs-link ${preview === a ? "on" : ""}`} onClick={() => setPreview(a)}>
                <span className="obs-swatch" style={{ background: colours[a] }} />
                <div className="obs-link-body">
                  <b>{AXIS_LABEL[a]}</b>
                  <input readOnly value={url(a)} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
                </div>
                <input type="color" value={colours[a]} title={`${AXIS_LABEL[a]} colour`}
                  onChange={(e) => setColours((c) => ({ ...c, [a]: e.target.value }))} />
                <button className="add-btn" onClick={() => copy(url(a), a)}>{copied === a ? "Copied" : "Copy"}</button>
              </div>
            ))}
            <p className="hint">
              Size in OBS: <b>{style.w} × {style.h}</b> suits these settings. All four links are also listed at{" "}
              <code>http://127.0.0.1:{port}/</code>.
            </p>
            <div className="row">
              <button className="ghost-btn" onClick={() => copy(AXES.map((a) => `${AXIS_LABEL[a]}: ${url(a)}`).join("\n"), "all")}>
                {copied === "all" ? "Copied all four" : "Copy all four"}
              </button>
              <button className="ghost-btn" onClick={() => { setStyle(DEFAULTS); setColours(DEFAULT_COLOUR); }}>Reset the look</button>
            </div>
          </section>

          <section className="vv-panel obs-style">
            <h2>The look</h2>
            <div className="obs-opts">
              <label>Width<input className="num" type="number" min={120} max={1920} value={style.w} onChange={(e) => set("w", Number(e.target.value))} /></label>
              <label>Height<input className="num" type="number" min={120} max={1080} value={style.h} onChange={(e) => set("h", Number(e.target.value))} /></label>
              <label>Line<input type="range" min={1} max={12} step={0.5} value={style.line} onChange={(e) => set("line", Number(e.target.value))} /><b>{style.line}</b></label>
              <label>Glow<input type="range" min={0} max={40} value={style.glow} onChange={(e) => set("glow", Number(e.target.value))} /><b>{style.glow}</b></label>
              <label>Margin<input type="range" min={0} max={60} value={style.pad} onChange={(e) => set("pad", Number(e.target.value))} /><b>{style.pad}</b></label>
              <label className="check"><input type="checkbox" checked={style.grid} onChange={(e) => set("grid", e.target.checked)} /> Grid</label>
              <label>Grid colour<input type="color" value={style.gridcolor} onChange={(e) => set("gridcolor", e.target.value)} /></label>
              <label>Grid strength<input type="range" min={0} max={1} step={0.02} value={style.gridalpha} onChange={(e) => set("gridalpha", Number(e.target.value))} /><b>{style.gridalpha.toFixed(2)}</b></label>
              <label className="check"><input type="checkbox" checked={style.ideal} onChange={(e) => set("ideal", e.target.checked)} /> Straight 1:1 line</label>
              <label className="check"><input type="checkbox" checked={style.dot} onChange={(e) => set("dot", e.target.checked)} /> Live dot</label>
              <label>Dot colour<input type="color" value={style.dotcolor} onChange={(e) => set("dotcolor", e.target.value)} /></label>
              <label>Dot size<input type="range" min={2} max={20} value={style.dotsize} onChange={(e) => set("dotsize", Number(e.target.value))} /><b>{style.dotsize}</b></label>
              <label className="check"><input type="checkbox" checked={style.guide} onChange={(e) => set("guide", e.target.checked)} /> Lines through the dot</label>
              <label className="check"><input type="checkbox" checked={style.label} onChange={(e) => set("label", e.target.checked)} /> Name</label>
              <label className="check"><input type="checkbox" checked={style.nums} onChange={(e) => set("nums", e.target.checked)} /> Numbers</label>
              <label className="check"><input type="checkbox" checked={style.fade} onChange={(e) => set("fade", e.target.checked)} /> Fade out when still</label>
              <label className="check">
                <input type="checkbox" checked={!!style.bg} onChange={(e) => set("bg", e.target.checked ? "#0e1813" : "")} /> Background
              </label>
              {!!style.bg && (
                <>
                  <label>Background colour<input type="color" value={style.bg} onChange={(e) => set("bg", e.target.value)} /></label>
                  <label>Corners<input type="range" min={0} max={40} value={style.round} onChange={(e) => set("round", Number(e.target.value))} /><b>{style.round}</b></label>
                </>
              )}
            </div>
          </section>

          <section className="vv-panel obs-preview">
            <h2>Preview <small>{AXIS_LABEL[preview]} · move the stick to see the dot</small></h2>
            <div className="obs-stage">
              {port > 0 && (
                <iframe key={nonce} title="overlay preview" src={url(preview)}
                  style={{ width: style.w, height: style.h }} />
              )}
            </div>
            <p className="hint">The checkerboard is only here - in OBS that part is see-through.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
