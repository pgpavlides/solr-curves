import { useMemo, useRef, useState } from "react";
import { type AxisCurve, type Pt, evaluator } from "./curve";

/*
  The curve, the control points, and the live stick.

  Precision tools, because a helicopter lives in the middle 20% of the stick:
    - zoom: the view can close in on the centre (±50 / ±25 / ±10 %)
    - Shift while dragging moves a point at a tenth of the mouse speed
    - arrow keys nudge the selected point by 0.1 (Shift: 1.0)
*/

const S = 560;      // svg size
const PAD = 34;     // room for the axis labels
const PLOT = S - PAD * 2;
export const MIN_GAP = 2; // % of stick between two points

interface Props {
  c: AxisCurve;
  range: number;                 // view half-range in %
  stickX: number | null;         // physical stick, -1..1
  combinedY: number | null;      // what the game gets, -1..1
  selected: number | null;
  maxPoints: number;
  onSelect: (i: number | null) => void;
  onPoints: (pts: Pt[], commit: boolean) => void;
  onNotice: (msg: string) => void;
}

export default function Graph({ c, range, stickX, combinedY, selected, maxPoints, onSelect, onPoints, onNotice }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; start: Pt; px: number; py: number } | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);

  const f = useMemo(() => evaluator(c), [c]);
  const R = range;
  const sx = (v: number) => PAD + ((v + R) / (2 * R)) * PLOT;
  const sy = (v: number) => PAD + ((R - v) / (2 * R)) * PLOT;

  const path = useMemo(() => {
    const n = 400;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const x = -R + (2 * R * i) / n;
      const y = f(x / 100) * 100;
      d += `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(Math.max(-R * 1.2, Math.min(R * 1.2, y))).toFixed(2)}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, R]);

  const grid = useMemo(() => {
    const step = R >= 100 ? 10 : R >= 50 ? 5 : R >= 25 ? 2.5 : 1;
    const lines: number[] = [];
    for (let v = -R; v <= R + 1e-6; v += step) lines.push(Math.round(v * 100) / 100);
    return { lines, label: R >= 100 ? 50 : R >= 50 ? 25 : R >= 25 ? 10 : 5 };
  }, [R]);

  const editable = c.mode === "points";
  const pts = c.points;
  // symmetric curves show the mirrored half as ghosts; only the real half drags
  const ghosts = editable && c.symmetric ? pts.filter((p) => p[0] > 0).map(([x, y]) => [-x, -y] as Pt) : [];

  // Screen -> svg units through the svg's own transform, so it stays right
  // when the graph is scaled to fit the window and letterboxed.
  const toPct = (e: { clientX: number; clientY: number }): Pt => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const u = (e.clientX * m.a + e.clientY * m.c + m.e);
    const v = (e.clientX * m.b + e.clientY * m.d + m.f);
    return [(u - PAD) / PLOT * 2 * R - R, R - (v - PAD) / PLOT * 2 * R];
  };

  const limits = (i: number): [number, number] => {
    const lo = c.symmetric ? 0 : -100;
    if (i === 0) return [lo, lo];
    if (i === pts.length - 1) return [100, 100];
    return [pts[i - 1][0] + 0.1, pts[i + 1][0] - 0.1];
  };

  const place = (i: number, x: number, y: number, commit: boolean) => {
    const [a, b] = limits(i);
    const nx = Math.round(Math.min(b, Math.max(a, x)) * 10) / 10;
    const ny = Math.round(Math.min(100, Math.max(-100, y)) * 10) / 10;
    const next = pts.map((p, j) => (j === i ? ([nx, ny] as Pt) : p));
    onPoints(next, commit);
  };

  const down = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelect(i);
    drag.current = { i, start: pts[i], px: e.clientX, py: e.clientY };
  };

  const move = (e: React.PointerEvent) => {
    const p = toPct(e);
    setHover(p);
    const d = drag.current;
    if (!d) return;
    const k = (1 / svg.current!.getScreenCTM()!.a) * (2 * R / PLOT) * (e.shiftKey ? 0.1 : 1);
    place(d.i, d.start[0] + (e.clientX - d.px) * k, d.start[1] - (e.clientY - d.py) * k, false);
  };

  const up = () => {
    if (drag.current) onPoints(pts, true);
    drag.current = null;
  };

  /*
    Double-click adds a point where you click. It used to also fire when the
    double-click landed ON a handle (the dblclick still bubbles up), dropping
    a new point a fraction of a percent from the old one, hidden under it.
    Now: never on a handle, never closer than MIN_GAP to another point, and
    every refusal says why.
  */
  const dbl = (e: React.MouseEvent) => {
    if (!editable) return;
    if ((e.target as Element).classList.contains("handle")) return;
    if (pts.length >= maxPoints) return onNotice(`Maximum ${maxPoints} points — remove one first`);
    let [x, y] = toPct(e);
    if (c.symmetric && x < 0) [x, y] = [-x, -y];
    const lo = c.symmetric ? 0 : -100;
    if (x <= lo || x >= 100) return;
    x = Math.round(x * 10) / 10;
    y = Math.round(y * 10) / 10;
    const near = pts.findIndex((p) => Math.abs(p[0] - x) < MIN_GAP);
    if (near >= 0) return onNotice(`Too close to point #${near + 1} — drag that one instead`);
    const next = [...pts, [x, y] as Pt].sort((a, b) => a[0] - b[0]);
    onPoints(next, true);
    onSelect(next.findIndex((p) => p[0] === x));
  };

  const key = (e: React.KeyboardEvent) => {
    if (!editable || selected === null) return;
    const s = e.shiftKey ? 1 : 0.1;
    const [x, y] = pts[selected];
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s],
    };
    if (moves[e.key]) {
      e.preventDefault();
      place(selected, x + moves[e.key][0], y + moves[e.key][1], true);
    } else if ((e.key === "Delete" || e.key === "Backspace") && selected > 0 && selected < pts.length - 1) {
      e.preventDefault();
      onPoints(pts.filter((_, j) => j !== selected), true);
      onSelect(null);
    }
  };

  const inView = (v: number) => v >= -R && v <= R;
  const liveX = stickX === null ? null : stickX * 100;
  const liveY = liveX === null ? null : f(stickX!) * 100;
  const gameY = combinedY === null ? null : combinedY * 100;

  return (
    <svg
      ref={svg}
      className="graph"
      viewBox={`0 0 ${S} ${S}`}
      tabIndex={0}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={dbl}
      onKeyDown={key}
      onPointerDown={() => onSelect(null)}
    >
      <rect x={PAD} y={PAD} width={PLOT} height={PLOT} className="plot-bg" />
      {grid.lines.map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={PAD} y2={PAD + PLOT} className={v === 0 ? "axis0" : "gridline"} />
          <line y1={sy(v)} y2={sy(v)} x1={PAD} x2={PAD + PLOT} className={v === 0 ? "axis0" : "gridline"} />
          {Math.abs(v % grid.label) < 1e-6 && (
            <>
              <text x={sx(v)} y={PAD + PLOT + 18} className="tick" textAnchor="middle">{v}</text>
              <text x={PAD - 8} y={sy(v) + 4} className="tick" textAnchor="end">{v}</text>
            </>
          )}
        </g>
      ))}
      <line x1={sx(-R)} y1={sy(-R)} x2={sx(R)} y2={sy(R)} className="linear" />
      <clipPath id="clip"><rect x={PAD} y={PAD} width={PLOT} height={PLOT} /></clipPath>
      <g clipPath="url(#clip)">
        <path d={path} className="curve" />
        {liveX !== null && inView(liveX) && (
          <>
            <line x1={sx(liveX)} x2={sx(liveX)} y1={PAD} y2={PAD + PLOT} className="live-line" />
            {liveY !== null && <circle cx={sx(liveX)} cy={sy(liveY)} r={6} className="live-dot" />}
            {gameY !== null && <circle cx={sx(liveX)} cy={sy(gameY)} r={10} className="game-dot" />}
          </>
        )}
        {ghosts.map(([x, y], i) => (
          <circle key={`g${i}`} cx={sx(x)} cy={sy(y)} r={5} className="ghost" />
        ))}
        {editable && pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={sx(x)}
            cy={sy(y)}
            r={selected === i ? 9 : 7}
            className={`handle ${selected === i ? "sel" : ""}`}
            onPointerDown={down(i)}
          />
        ))}
      </g>
      {hover && inView(hover[0]) && inView(hover[1]) && (
        <text x={PAD + PLOT - 6} y={PAD + 16} className="hover" textAnchor="end">
          {hover[0].toFixed(1)}% → {(f(hover[0] / 100) * 100).toFixed(1)}%
        </text>
      )}
    </svg>
  );
}
