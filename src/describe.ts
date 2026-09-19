import { AXES, AXIS_LABEL, SIDE_LABEL, type AxisCurve, type AxisName, type Side, type SideName } from "./curve";

/*
  The log line T.A.R.G.E.T. prints when it loads a table:

    19 Sep 2026  01:23:45  |  Roll right: deadzone 2 -> 3  |  #898010556

  The script adds the "#<table>" part; everything before it is built here,
  because T.A.R.G.E.T.'s script language has no clock. Plain ASCII only: the
  script prints it byte by byte, and anything else comes out as mojibake in
  the Script Editor console.
*/

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

export function stamp(d = new Date()) {
  return `${two(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}  ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

const FIELDS: [keyof Side, string, string][] = [
  ["mode", "mode", ""],
  ["deadzone", "deadzone", "%"],
  ["curve", "curve", ""],
  ["saturation", "end saturation", "%"],
  ["outMax", "max output", "%"],
  ["smooth", "smooth", ""],
];

const val = (k: keyof Side, v: unknown) =>
  k === "mode" ? (v === "scurve" ? "S-curve" : "points") : k === "smooth" ? (v ? "on" : "off") : String(v);

function sideChanges(a: Side, b: Side): string[] {
  const out: string[] = [];
  for (const [k, name, unit] of FIELDS) {
    if (a[k] !== b[k]) out.push(`${name} ${val(k, a[k])}${unit} -> ${val(k, b[k])}${unit}`);
  }
  if (b.mode === "points" && JSON.stringify(a.points) !== JSON.stringify(b.points)) {
    out.push(a.points.length === b.points.length ? "points moved" : `points ${a.points.length} -> ${b.points.length}`);
  }
  return out;
}

function axisChanges(name: AxisName, a: AxisCurve, b: AxisCurve): string[] {
  const label = AXIS_LABEL[name].replace(/ \(.*\)/, "");
  const out: string[] = [];
  if (a.linked !== b.linked) out.push(`${label}: sides ${b.linked ? "linked" : "split"}`);
  if (a.invert !== b.invert) out.push(`${label}: invert ${b.invert ? "on" : "off"}`);
  if (b.linked) {
    const ch = sideChanges(a.pos, b.pos);
    if (ch.length) out.push(`${label}: ${ch.join(", ")}`);
  } else {
    for (const s of ["neg", "pos"] as SideName[]) {
      const ch = sideChanges(a[s], b[s]);
      if (ch.length) out.push(`${label} ${SIDE_LABEL[name][s].toLowerCase()}: ${ch.join(", ")}`);
    }
  }
  return out;
}

/** "19 Sep 2026  01:23:45  |  <what changed>", at most ~180 chars, ASCII. */
export function logLine(prev: Record<AxisName, AxisCurve> | null, next: Record<AxisName, AxisCurve>, when = new Date()) {
  let what: string;
  if (!prev) what = "app opened, curves sent";
  else {
    const all = AXES.flatMap((a) => axisChanges(a, prev[a], next[a]));
    what = all.length === 0 ? "no curve change" : all.length <= 2 ? all.join("; ") : `${all.slice(0, 2).join("; ")}; +${all.length - 2} more`;
  }
  const line = `${stamp(when)}  |  ${what}`;
  return line.replace(/[^\x20-\x7e]/g, "?").slice(0, 190);
}
