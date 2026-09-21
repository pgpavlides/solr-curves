import { useMemo } from "react";
import { type AxisCurve, evaluator } from "./curve";

/*
  One axis's curve, small and read-only, for the side-by-side view: the curve,
  where your hand is on it, and what the game gets. Click it to edit that axis.
*/

interface Props {
  title: string;
  c: AxisCurve;
  color: string;
  range: number;
  stickX: number | null;
  combinedY: number | null;
  active: boolean;
  onOpen: () => void;
}

const S = 300;
const PAD = 22;
const PLOT = S - PAD * 2;

export default function MiniGraph({ title, c, color, range, stickX, combinedY, active, onOpen }: Props) {
  const f = useMemo(() => evaluator(c), [c]);
  const R = range;
  const sx = (v: number) => PAD + ((v + R) / (2 * R)) * PLOT;
  const sy = (v: number) => PAD + ((R - v) / (2 * R)) * PLOT;
  const clampY = (y: number) => Math.max(-R * 1.2, Math.min(R * 1.2, y));

  const path = useMemo(() => {
    let d = "";
    for (let i = 0; i <= 240; i++) {
      const x = -R + (2 * R * i) / 240;
      d += `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(clampY(f(x / 100) * 100)).toFixed(1)}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, R]);

  const liveX = stickX === null ? null : stickX * 100;
  const liveY = stickX === null ? null : f(stickX) * 100;
  const gameY = combinedY === null ? null : combinedY * 100;
  const inView = (v: number) => v >= -R && v <= R;
  const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? " " : ""}${v.toFixed(1)}%`);

  return (
    <button className={`mini ${active ? "on" : ""}`} style={{ ["--c" as string]: color }} onClick={onOpen}
      title={`Edit ${title}`}>
      <div className="mini-head">
        <i />
        <b>{title}</b>
        <span className="muted">
          hand {pct(liveX)} · curve {pct(liveY)} · game {pct(gameY)}
        </span>
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} className="mini-svg">
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} className="mini-bg" />
        {[-R / 2, 0, R / 2].map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={PAD} y2={PAD + PLOT} className={v === 0 ? "mini-axis" : "mini-gl"} />
            <line y1={sy(v)} y2={sy(v)} x1={PAD} x2={PAD + PLOT} className={v === 0 ? "mini-axis" : "mini-gl"} />
          </g>
        ))}
        <line x1={sx(-R)} y1={sy(-R)} x2={sx(R)} y2={sy(R)} className="mini-gl" />
        <path d={path} className="mini-curve" />
        {liveX !== null && inView(liveX) && (
          <>
            <line x1={sx(liveX)} x2={sx(liveX)} y1={PAD} y2={PAD + PLOT} className="mini-live-line" />
            {liveY !== null && <circle cx={sx(liveX)} cy={sy(clampY(liveY))} r={6} className="mini-dot" />}
            {gameY !== null && <circle cx={sx(liveX)} cy={sy(clampY(gameY))} r={10} className="mini-ring" />}
          </>
        )}
      </svg>
    </button>
  );
}
