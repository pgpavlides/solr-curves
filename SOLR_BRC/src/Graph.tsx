import { useMemo, useRef, useState } from "react";
import { type AxisCurve, type Pt, type SideName, evaluator } from "./curve";

/*
  The curve, the control points, and the live stick.

  Each side of the stick is its own curve. Points are stored as magnitudes
  (0..100 from centre), so the − side's point (30, 12) is DRAWN at (−30, −12).
  `flip` below is that one conversion, used both ways.

  Precision tools, because a helicopter lives in the middle 20% of the stick:
    - zoom: the view can close in on the centre (±50 / ±25 / ±10 %)
    - Shift while dragging moves a point at a tenth of the mouse speed
    - arrow keys nudge the selected point by 0.1 (Shift: 1.0), in screen directions
*/

const S = 560;      // svg size
const PAD = 34;     // room for the axis labels
const PLOT = S - PAD * 2;
export const MIN_GAP = 2; // % of stick between two points

interface Props {
  c: AxisCurve;
  side: SideName;                // the side being edited (pos when linked)
  range: number;                 // view half-range in %
  stickX: number | null;         // physical stick, -1..1
  combinedY: number | null;      // what the game gets, -1..1
  selected: number | null;
  maxPoints: number;
  onSelect: (i: number | null) => void;
  /** side defaults to the one being edited */
  onPoints: (pts: Pt[], commit: boolean, side?: SideName) => void;
  onSide: (side: SideName, select: number | null) => void;
  onNotice: (msg: string) => void;
  /** the other axes' curves, drawn thin behind this one for comparison */
  others?: { name: string; c: AxisCurve; color: string }[];
  /** this curve's own colour, when it is drawn among the others */
  color?: string;
}

export default function Graph({ c, side, range, stickX, combinedY, selected, maxPoints, onSelect, onPoints, onSide, onNotice, others = [], color }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; start: Pt; px: number; py: number } | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);

  const f = useMemo(() => evaluator(c), [c]);
  const R = range;
  const sx = (v: number) => PAD + ((v + R) / (2 * R)) * PLOT;
  const sy = (v: number) => PAD + ((R - v) / (2 * R)) * PLOT;
  const sgn = (s: SideName) => (s === "neg" ? -1 : 1);
  const flip = (s: SideName, [x, y]: Pt): Pt => [sgn(s) * x, sgn(s) * y];

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

  // the same line for every other axis shown alongside
  const otherPaths = useMemo(() => others.map((o) => {
    const g = evaluator(o.c);
    const n = 300;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const x = -R + (2 * R * i) / n;
      const y = g(x / 100) * 100;
      d += `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(Math.max(-R * 1.2, Math.min(R * 1.2, y))).toFixed(2)}`;
    }
    return { ...o, d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [others, R]);

  const grid = useMemo(() => {
    const step = R >= 100 ? 10 : R >= 50 ? 5 : R >= 25 ? 2.5 : 1;
    const lines: number[] = [];
    for (let v = -R; v <= R + 1e-6; v += step) lines.push(Math.round(v * 100) / 100);
    return { lines, label: R >= 100 ? 50 : R >= 50 ? 25 : R >= 25 ? 10 : 5 };
  }, [R]);

  const other: SideName = side === "pos" ? "neg" : "pos";
  const cur = c[side];
  const editable = cur.mode === "points";
  const pts = cur.points;
  const otherPts = c.linked ? null : c[other].mode === "points" ? c[other].points : null;

  const toPct = (e: { clientX: number; clientY: number }): Pt => {
    // screen -> svg units through the svg's own transform (right when letterboxed)
    const m = svg.current!.getScreenCTM()!.inverse();
    const u = e.clientX * m.a + e.clientY * m.c + m.e;
    const v = e.clientX * m.b + e.clientY * m.d + m.f;
    return [(u - PAD) / PLOT * 2 * R - R, R - (v - PAD) / PLOT * 2 * R];
  };

  const limits = (i: number): [number, number] => {
    if (i === 0) return [0, 0];
    if (i === pts.length - 1) return [100, 100];
    return [pts[i - 1][0] + 0.1, pts[i + 1][0] - 0.1];
  };

  // x, y in the side's own magnitude terms
  const place = (i: number, x: number, y: number, commit: boolean) => {
    const [a, b] = limits(i);
    const nx = Math.round(Math.min(b, Math.max(a, x)) * 10) / 10;
    const ny = Math.round(Math.min(100, Math.max(-100, y)) * 10) / 10;
    onPoints(pts.map((p, j) => (j === i ? ([nx, ny] as Pt) : p)), commit);
  };

  const down = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelect(i);
    drag.current = { i, start: pts[i], px: e.clientX, py: e.clientY };
  };

  // a point on the other side: switch to that side with it selected
  const downOther = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    onSide(other, i);
  };

  const move = (e: React.PointerEvent) => {
    setHover(toPct(e));
    const d = drag.current;
    if (!d) return;
    const k = (1 / svg.current!.getScreenCTM()!.a) * (2 * R / PLOT) * (e.shiftKey ? 0.1 : 1);
    const s = sgn(side);
    place(d.i, d.start[0] + s * (e.clientX - d.px) * k, d.start[1] - s * (e.clientY - d.py) * k, false);
  };

  const up = () => {
    if (drag.current) onPoints(pts, true);
    drag.current = null;
  };

  /*
    Double-click adds a point where you click, on the side you click. It is
    ignored on a handle (the dblclick bubbles up from it, and used to drop a
    twin a fraction of a percent away, hidden under the old one), and never
    closer than MIN_GAP to another point. Every refusal says why.
  */
  const dbl = (e: React.MouseEvent) => {
    if ((e.target as Element).classList.contains("handle")) return;
    const [gx, gy] = toPct(e);
    const clicked: SideName = c.linked ? "pos" : gx < 0 ? "neg" : "pos";
    const target = c[clicked];
    if (target.mode !== "points") {
      if (!c.linked && clicked !== side) onSide(clicked, null);
      return onNotice("That side is an S-curve — switch it to Custom points to add points");
    }
    const tp = target.points;
    if (tp.length >= maxPoints) return onNotice(`Maximum ${maxPoints} points per side — remove one first`);
    let [x, y] = gx < 0 ? [-gx, -gy] : [gx, gy];
    if (x <= 0 || x >= 100) return;
    x = Math.round(x * 10) / 10;
    y = Math.round(y * 10) / 10;
    const near = tp.findIndex((p) => Math.abs(p[0] - x) < MIN_GAP);
    if (near >= 0) return onNotice(`Too close to point #${near + 1} — drag that one instead`);
    const next = [...tp, [x, y] as Pt].sort((a, b) => a[0] - b[0]);
    const idx = next.findIndex((p) => p[0] === x);
    onPoints(next, true, clicked);
    if (clicked !== side) onSide(clicked, idx);
    else onSelect(idx);
  };

  const key = (e: React.KeyboardEvent) => {
    if (!editable || selected === null || !pts[selected]) return;
    const st = (e.shiftKey ? 1 : 0.1) * sgn(side); // screen direction -> side terms
    const [x, y] = pts[selected];
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st],
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

  // the half being edited is lit, the other dimmed (unless linked: both are it)
  const shade = c.linked ? null : { x: side === "pos" ? PAD : sx(0), w: PLOT / 2 };

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
      {shade && <rect x={shade.x} y={PAD} width={shade.w} height={PLOT} className="shade" />}
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
        {otherPaths.map((o) => (
          <path key={o.name} d={o.d} className="curve-other" style={{ stroke: o.color }} />
        ))}
        <path d={path} className="curve" style={color ? { stroke: color } : undefined} />
        {liveX !== null && inView(liveX) && (
          <>
            <line x1={sx(liveX)} x2={sx(liveX)} y1={PAD} y2={PAD + PLOT} className="live-line" />
            {liveY !== null && <circle cx={sx(liveX)} cy={sy(liveY)} r={6} className="live-dot" />}
            {gameY !== null && <circle cx={sx(liveX)} cy={sy(gameY)} r={10} className="game-dot" />}
          </>
        )}
        {/* linked: the − side is the same points, shown as ghosts */}
        {editable && c.linked && pts.filter((p) => p[0] > 0).map((p, i) => {
          const [x, y] = flip("neg", p);
          return <circle key={`g${i}`} cx={sx(x)} cy={sy(y)} r={5} className="ghost" />;
        })}
        {/* split: the other side's points, dim; click one to edit that side */}
        {otherPts && otherPts.map((p, i) => {
          const [x, y] = flip(other, p);
          return <circle key={`o${i}`} cx={sx(x)} cy={sy(y)} r={6} className="handle other" onPointerDown={downOther(i)} />;
        })}
        {editable && pts.map((p, i) => {
          const [x, y] = flip(side, p);
          return (
            <circle
              key={i}
              cx={sx(x)}
              cy={sy(y)}
              r={selected === i ? 9 : 7}
              className={`handle ${selected === i ? "sel" : ""}`}
              onPointerDown={down(i)}
            />
          );
        })}
      </g>
      {hover && inView(hover[0]) && inView(hover[1]) && (
        <text x={PAD + PLOT - 6} y={PAD + 16} className="hover" textAnchor="end">
          {hover[0].toFixed(1)}% → {(f(hover[0] / 100) * 100).toFixed(1)}%
        </text>
      )}
    </svg>
  );
}
