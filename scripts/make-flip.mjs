/*
  Generate the `flip` maneuver's keys for data/maneuvers.ts.

  WHERE THE NUMBERS COME FROM
  ---------------------------
  The heading column is measured, not invented: frames were pulled out of Arma
  Pilot's "The BEST Helicopter Settings in WARDOGS" (SiZBHRrblNA) and the
  compass tape was read off each one — a quarter of a second apart through the
  flip itself, half a second apart down to the touchdown.

    3:45.0  357   3:46.0  031   3:47.0  004   3:49.0  344   3:51.0  289
    3:45.25 011   3:46.25 030   3:48.0  327   3:49.5  344   3:51.5  269
    3:45.5  023   3:46.5  025   3:48.5  327   3:50.0  328   3:52.0  253
    3:45.75 029   3:46.75 016                 3:50.5  310   3:52.5  243

  Off a run-in of 338, that is the shape of the whole thing: the tail swings 53
  degrees RIGHT as the nose comes up, and then the aircraft yaws 148 degrees
  LEFT on the way down, landing facing south-west off a north-north-west
  approach. Nobody would have guessed either number.

  WHAT IS AUTHORED
  ----------------
  Everything else. WARDOGS' third-person HUD carries a compass and nothing
  else — no airspeed, no altitude — so the speed, height, attitude and control
  columns are written to be correct and flyable rather than extracted. They are
  matched to the footage frame by frame (the dive attitude at 3:45.25, the
  vertical nose at 3:46.0, wings level again by 3:47) and to what the aircraft
  has to be doing for that to happen.

  Position is integrated from the speed column rather than typed, so the
  aircraft cannot cover ground it does not have the speed for. The track is
  straight: through the flip the nose is 50 degrees off the flight path and
  pointing at the sky, and the aircraft keeps going the way it was already
  going. That decoupling is the maneuver.

  usage: node scripts/make-flip.mjs
*/

/* Heading of the run-in, and the datum the file's hdg column is measured from. */
const HDG0 = 338;

/*
  time   the clock in the video, seconds
  hdg    compass heading read off the tape (degrees, game convention)
  pitch  nose-up positive
  roll   right bank positive
  ias    km/h
  alt    metres above the landing zone
  coll   0..1
  cyc    [lateral, fore-aft], fore-aft positive = aft
  ped    -1 full left .. +1 full right
*/
const KNOTS = [
  // ---- run-in: heading measured at 3:44.5, held straight before that -------
  { time: 223.0,  hdg: 338, pitch:  -8, roll:   0, ias: 228, alt: 128, coll: 0.60, cyc: [ 0.00, -0.16], ped: -0.02 },
  { time: 224.0,  hdg: 338, pitch: -18, roll:   0, ias: 238, alt: 112, coll: 0.42, cyc: [ 0.00, -0.28], ped: -0.02 },
  { time: 224.5,  hdg: 338, pitch: -26, roll:   4, ias: 244, alt: 100, coll: 0.30, cyc: [ 0.03, -0.36], ped:  0.02 },
  // ---- the flip: every heading below is read off the tape ------------------
  { time: 225.0,  hdg: 357, pitch: -40, roll:  10, ias: 246, alt:  86, coll: 0.22, cyc: [ 0.10, -0.44], ped:  0.20 },
  { time: 225.25, hdg:  11, pitch: -34, roll:  16, ias: 240, alt:  79, coll: 0.20, cyc: [ 0.16, -0.20], ped:  0.34 },
  { time: 225.5,  hdg:  23, pitch: -18, roll:  22, ias: 224, alt:  72, coll: 0.18, cyc: [ 0.22,  0.55], ped:  0.42 },
  { time: 225.75, hdg:  29, pitch:  38, roll:  25, ias: 180, alt:  66, coll: 0.16, cyc: [ 0.24,  0.92], ped:  0.40 },
  { time: 226.0,  hdg:  31, pitch:  72, roll:  22, ias: 128, alt:  61, coll: 0.15, cyc: [ 0.20,  1.00], ped:  0.30 },
  { time: 226.25, hdg:  30, pitch:  66, roll:  14, ias:  96, alt:  57, coll: 0.18, cyc: [ 0.12,  0.86], ped:  0.12 },
  { time: 226.5,  hdg:  25, pitch:  42, roll:   6, ias:  74, alt:  54, coll: 0.24, cyc: [ 0.04,  0.55], ped: -0.10 },
  { time: 226.75, hdg:  16, pitch:  16, roll:   0, ias:  58, alt:  51, coll: 0.32, cyc: [-0.02,  0.24], ped: -0.24 },
  { time: 227.0,  hdg:   4, pitch:  -4, roll:  -4, ias:  48, alt:  48, coll: 0.40, cyc: [-0.04, -0.05], ped: -0.35 },
  // ---- down into the stadium, nose swinging left the whole way -------------
  // 227.5 is the one interpolated heading: that frame was lost to an ad break.
  { time: 227.5,  hdg: 345, pitch:  -6, roll:  -6, ias:  40, alt:  42, coll: 0.44, cyc: [-0.05, -0.08], ped: -0.40 },
  { time: 228.0,  hdg: 327, pitch:   4, roll:  -4, ias:  32, alt:  35, coll: 0.50, cyc: [-0.04,  0.10], ped: -0.10 },
  { time: 228.5,  hdg: 327, pitch:   6, roll:  -2, ias:  26, alt:  30, coll: 0.52, cyc: [-0.03,  0.12], ped:  0.15 },
  { time: 229.0,  hdg: 344, pitch:   5, roll:  -1, ias:  21, alt:  25, coll: 0.54, cyc: [-0.02,  0.11], ped:  0.25 },
  { time: 229.5,  hdg: 344, pitch:   4, roll:   0, ias:  17, alt:  20, coll: 0.55, cyc: [-0.01,  0.09], ped:  0.00 },
  { time: 230.0,  hdg: 328, pitch:   3, roll:   1, ias:  14, alt:  16, coll: 0.56, cyc: [ 0.01,  0.07], ped: -0.25 },
  { time: 230.5,  hdg: 310, pitch:   3, roll:   2, ias:  11, alt:  12, coll: 0.56, cyc: [ 0.02,  0.06], ped: -0.45 },
  { time: 231.0,  hdg: 289, pitch:   2, roll:   2, ias:   8, alt:   9, coll: 0.57, cyc: [ 0.03,  0.05], ped: -0.50 },
  { time: 231.5,  hdg: 269, pitch:   2, roll:   1, ias:   6, alt:   6, coll: 0.57, cyc: [ 0.02,  0.04], ped: -0.50 },
  { time: 232.0,  hdg: 253, pitch:   1, roll:   1, ias:   4, alt:   4, coll: 0.57, cyc: [ 0.02,  0.03], ped: -0.40 },
  { time: 232.5,  hdg: 243, pitch:   1, roll:   0, ias:   2, alt:   2, coll: 0.56, cyc: [ 0.01,  0.02], ped: -0.15 },
  { time: 233.0,  hdg: 245, pitch:   0, roll:   0, ias:   1, alt: 0.4, coll: 0.54, cyc: [ 0.00,  0.01], ped:  0.05 },
  { time: 234.0,  hdg: 245, pitch:   0, roll:   0, ias:   0, alt:   0, coll: 0.50, cyc: [ 0.00,  0.00], ped: -0.10 },
];

const T0 = KNOTS[0].time;
const T1 = KNOTS[KNOTS.length - 1].time;

/**
 * Compass heading to the file's column.
 *
 * data/maneuvers.ts measures hdg so that INCREASING is a yaw to the LEFT; the
 * game's compass increases to the RIGHT. So the sign flips, and the run-in
 * heading becomes zero. Unwrapped through north, or 357 would read as a 338
 * degree turn the wrong way.
 */
let unwrapped = HDG0;
function toFileHdg(game) {
  // unwrap against the PREVIOUS reading, not the datum: a trace that wandered
  // more than 180 degrees from the run-in would otherwise fold back on itself
  let step = game - ((unwrapped % 360) + 360) % 360;
  while (step > 180) step -= 360;
  while (step < -180) step += 360;
  unwrapped += step;
  return -(unwrapped - HDG0);
}

/** Linear interpolation of the speed column, in m/s. */
function speedAt(t) {
  if (t <= KNOTS[0].time) return KNOTS[0].ias / 3.6;
  for (let i = 0; i < KNOTS.length - 1; i++) {
    const a = KNOTS[i], b = KNOTS[i + 1];
    if (t <= b.time) {
      const s = (t - a.time) / (b.time - a.time);
      return (a.ias + (b.ias - a.ias) * s) / 3.6;
    }
  }
  return KNOTS[KNOTS.length - 1].ias / 3.6;
}

/*
  Distance travelled, by trapezoid over 5 ms steps. Fine enough that halving
  it moves the answer by less than a centimetre, which is well under the two
  decimals that get printed.
*/
const STEP = 0.005;
const dist = new Map();
let z = 0;
dist.set(T0, 0);
for (let t = T0; t < T1 - 1e-9; t += STEP) {
  z += ((speedAt(t) + speedAt(t + STEP)) / 2) * STEP;
  dist.set(+(t + STEP).toFixed(3), z);
}
const total = z;

function zAt(t) {
  const key = +t.toFixed(3);
  if (dist.has(key)) return dist.get(key);
  // fall back to walking the steps for a knot that is not on the grid
  let acc = 0;
  for (let u = T0; u < t - 1e-9; u += STEP) {
    const h = Math.min(STEP, t - u);
    acc += ((speedAt(u) + speedAt(u + h)) / 2) * h;
  }
  return acc;
}

const r2 = (n) => +n.toFixed(2);
const r3 = (n) => +n.toFixed(3);

console.log(`    /* generated by scripts/make-flip.mjs — ${KNOTS.length} keys, ${total.toFixed(0)} m of track */`);
for (const k of KNOTS) {
  const t = r3((k.time - T0) / (T1 - T0));
  // land on the origin, so the track runs in from negative z
  const zz = r2(zAt(k.time) - total);
  const line =
    `    K(${t.toFixed(3)}, [0, ${r2(k.alt)}, ${zz}], ` +
    `${r2(toFileHdg(k.hdg))}, ${k.pitch}, ${k.roll}, ${k.coll}, ` +
    `[${k.cyc[0]}, ${k.cyc[1]}], ${k.ped}, ${k.ias}),`;
  console.log(line);
}
console.error(`\n${KNOTS.length} keys, ${(T1 - T0).toFixed(1)} s of video, ${total.toFixed(1)} m of ground covered`);
