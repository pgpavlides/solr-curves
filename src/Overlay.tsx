import { useEffect, useMemo, useState } from "react";
import { usePads } from "./gamepad";
import { loadState, emitEvent, onEvent } from "./bridge";
import { AXES, AXIS_LABEL, type AxisCurve, type AxisName, defaultAxis, evaluator, migrate } from "./curve";

/*
  The in-game overlay window: three small curve cards and the live stick.
  Transparent, click-through and always on top (see set_overlay in lib.rs);
  it draws only what it is sent, plus the stick it reads itself, so it keeps
  moving with the editor minimised.
*/

export type OverlaySize = "S" | "M" | "L";

export interface OverlayData {
  axes: Record<AxisName, AxisCurve>;
  input: Record<AxisName, number>;
  opacity: number; // 0.3 .. 1
}

// one card is CARD[size] square; the window is sized to fit three in a row
export const CARD: Record<OverlaySize, number> = { S: 120, M: 160, L: 210 };
const PAD = 8, GAP = 8, LABEL = 20;
export const overlayWindowSize = (s: OverlaySize) => ({
  width: 3 * CARD[s] + 2 * GAP + 2 * PAD,
  height: CARD[s] + LABEL + 2 * PAD,
});

export default function Overlay() {
  const [data, setData] = useState<OverlayData | null>(null);
  const [width, setWidth] = useState(window.innerWidth);
  const pads = usePads();

  useEffect(() => {
    document.documentElement.classList.add("overlay-root");
    const off = onEvent<OverlayData>("solr:overlay", setData);
    emitEvent("solr:overlay-ready");
    // until the editor answers: the saved state
    loadState()
      .then((j) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = j.state as any;
        if (!s?.axes) return;
        const axes = Object.fromEntries(AXES.map((a) => [a, migrate(s.axes[a], a)])) as OverlayData["axes"];
        setData((d) => d ?? { axes, input: { roll: 0, pitch: 1, yaw: 5, ...(s.input ?? {}) }, opacity: 0.85 });
      })
      .catch(() => {});
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => { off(); window.removeEventListener("resize", resize); };
  }, []);

  const axes = data?.axes ?? { roll: defaultAxis("roll"), pitch: defaultAxis("pitch"), yaw: defaultAxis("yaw") };
  const card = Math.max(60, Math.floor((width - 2 * PAD - 2 * GAP) / 3));

  return (
    <div className="ov" style={{ opacity: data?.opacity ?? 0.85, padding: PAD, gap: GAP }}>
      {AXES.map((a) => (
        <Card
          key={a}
          name={a}
          c={axes[a]}
          size={card}
          x={pads.stick && data ? pads.stick.axes[data.input[a]] ?? null : null}
        />
      ))}
    </div>
  );
}

function Card({ name, c, size, x }: { name: AxisName; c: AxisCurve; size: number; x: number | null }) {
  const f = useMemo(() => evaluator(c), [c]);
  const P = 5; // inner margin
  const sx = (v: number) => P + ((v + 1) / 2) * (size - 2 * P);
  const sy = (v: number) => P + ((1 - v) / 2) * (size - 2 * P);
  const path = useMemo(() => {
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const v = -1 + i / 60;
      d += `${i ? "L" : "M"}${sx(v).toFixed(1)},${sy(f(v)).toFixed(1)}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, size]);
  const y = x === null ? null : f(x);
  const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;

  return (
    <div className="ov-card" style={{ width: size }}>
      <div className="ov-label">
        <span>{AXIS_LABEL[name].replace(/ \(.*\)/, "")}{!c.linked && <i> split</i>}</span>
        <b>{y === null ? "—" : pct(y)}</b>
      </div>
      <svg width={size} height={size} className="ov-graph">
        <rect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={8} className="ov-bg" />
        <line x1={sx(0)} x2={sx(0)} y1={P} y2={size - P} className="ov-axis" />
        <line y1={sy(0)} y2={sy(0)} x1={P} x2={size - P} className="ov-axis" />
        <line x1={sx(-1)} y1={sy(-1)} x2={sx(1)} y2={sy(1)} className="ov-linear" />
        <path d={path} className="ov-curve" />
        {x !== null && y !== null && (
          <>
            <line x1={sx(x)} x2={sx(x)} y1={P} y2={size - P} className="ov-live-line" />
            <circle cx={sx(x)} cy={sy(y)} r={Math.max(3, size / 32)} className="ov-dot" />
          </>
        )}
      </svg>
    </div>
  );
}
