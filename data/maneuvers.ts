/*
  Maneuvers, as authored timelines rather than a physics simulation.

  A guide has to show the *correct* execution every time — repeatable, and with
  the stick and pedal positions that produce it. A physics sim would wander, and
  the whole point here is that you can watch the inputs and the aircraft at the
  same moment.

  Frame of reference matches the exported model: +Y up, +Z is the nose.
  Positions are metres, angles degrees, control inputs normalised.

  SIGN CONVENTION — verified against the renderer, not assumed. With nose +Z
  and up +Y, right = forward x up = (-1,0,0), so **+X is the aircraft's LEFT**.
  Yaw about +Y swings the nose from +Z toward +X, so **increasing hdg is a LEFT
  turn**. Roll about +Z lifts the left wing, so **positive roll is a RIGHT
  bank**. A coordinated turn therefore has sign(roll) opposite to sign(d hdg).
  Getting this backwards banks the aircraft against its own turn.

  The `turn` and `jhook` tracks are generated from their geometry rather than
  hand-authored, so heading and bank cannot drift out of agreement with the
  flight path.
*/

export interface Key {
  /** 0..1 through the maneuver */
  t: number;
  /** world position, metres */
  p: [number, number, number];
  /** heading in degrees; 0 = nose along +Z, INCREASING = yaw left */
  hdg: number;
  /** nose-up positive */
  pitch: number;
  /** positive = RIGHT bank (see the sign convention above) */
  roll: number;
  /** collective lever, 0 = full down, 1 = full up */
  coll: number;
  /** cyclic stick: [lateral, fore-aft]; -1..1, fore-aft positive = aft (nose up) */
  cyc: [number, number];
  /** pedals, -1 = full left, 1 = full right */
  ped: number;
  /** indicated airspeed, km/h */
  ias: number;
}

export interface Phase {
  at: number;
  title: string;
  detail: string;
}

export interface Maneuver {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  /** seconds for one pass */
  duration: number;
  /** true when the aircraft should loop seamlessly (hover, pedal turn) */
  loops: boolean;
  keys: Key[];
  phases: Phase[];
  /** the one thing people get wrong */
  watchFor: string;
}

const K = (
  t: number,
  p: [number, number, number],
  hdg: number,
  pitch: number,
  roll: number,
  coll: number,
  cyc: [number, number],
  ped: number,
  ias: number
): Key => ({ t, p, hdg, pitch, roll, coll, cyc, ped, ias });

export const maneuvers: Maneuver[] = [
  {
    id: "hover",
    name: "Hover",
    tag: "Foundation",
    blurb:
      "Holding one spot in three dimensions. Nothing else works until this does — every landing ends in a hover, and every drill starts from one.",
    duration: 14,
    loops: true,
    watchFor:
      "The collective barely moves. What is moving constantly is the cyclic, in inputs far smaller than they look — a hover is dozens of tiny corrections per minute, not one big one.",
    keys: [
      K(0.0, [0, 3, 0], 0, 0, 0, 0.56, [0, 0], 0, 0),
      K(0.14, [0.16, 3.05, 0.1], 1.5, 1.2, 1.6, 0.57, [0.14, 0.1], 0.08, 2),
      K(0.3, [0.05, 2.96, -0.14], -1.2, -0.9, -1.4, 0.55, [-0.12, -0.08], -0.07, 2),
      K(0.46, [-0.14, 3.04, 0.06], 1.0, 0.8, 1.1, 0.57, [0.1, 0.07], 0.06, 1),
      K(0.62, [0.02, 2.94, 0.16], -0.8, -1.1, -1.2, 0.55, [-0.1, -0.09], -0.05, 2),
      K(0.8, [0.12, 3.03, -0.08], 1.2, 0.9, 1.3, 0.57, [0.11, 0.08], 0.07, 1),
      K(1.0, [0, 3, 0], 0, 0, 0, 0.56, [0, 0], 0, 0),
    ],
    phases: [
      { at: 0.0, title: "Set the power", detail: "Collective to the hover figure and leave it there. Chasing altitude with the collective is what starts a porpoise." },
      { at: 0.25, title: "Correct with the cyclic", detail: "Drift is stopped with tiny stick pressures, not movements. If you can see your own input, it was too big." },
      { at: 0.6, title: "Pedals hold the nose", detail: "The tail rotor keeps the heading while the cyclic keeps the position. They are separate jobs." },
      { at: 0.85, title: "Hold the picture", detail: "Pick a reference on the horizon and fly the picture, not the instruments." },
    ],
  },

  {
    id: "takeoff",
    name: "Vertical takeoff",
    tag: "Departure",
    blurb:
      "Straight up off the skids to a safe height. The one maneuver where the collective is genuinely the main event.",
    duration: 11,
    loops: false,
    watchFor:
      "As the collective comes up the airframe wants to yaw — that is torque, and the pedal is what cancels it. Rising smoothly matters more than rising fast.",
    keys: [
      K(0.0, [0, 0, 0], 0, 0, 0, 0.2, [0, 0], 0, 0),
      K(0.18, [0, 0.05, 0], 0, 0.5, 0, 0.46, [0, 0.05], -0.1, 0),
      K(0.3, [0, 0.9, 0], -1.0, 1.0, 0, 0.62, [0, 0.08], -0.22, 0),
      K(0.5, [0, 4.2, 0.1], -0.6, 0.6, 0.4, 0.7, [0.04, 0.05], -0.2, 3),
      K(0.72, [0, 9.0, 0.2], 0, 0.3, 0, 0.68, [0, 0.03], -0.16, 2),
      K(0.88, [0, 12.0, 0.2], 0, 0.2, 0, 0.6, [0, 0.02], -0.13, 1),
      K(1.0, [0, 13.0, 0.2], 0, 0, 0, 0.57, [0, 0], -0.12, 0),
    ],
    phases: [
      { at: 0.0, title: "Light on the skids", detail: "Collective up slowly until the aircraft goes light and the airframe settles onto the rotor." },
      { at: 0.24, title: "Break ground", detail: "A little more collective and it lifts. Pedal in as the power comes up, or the nose swings." },
      { at: 0.42, title: "Climb", detail: "Hold the attitude level and let the collective do the work. Do not pull the nose up to climb." },
      { at: 0.8, title: "Level off", detail: "Ease the collective back toward the hover figure as you reach height, or you will overshoot it." },
    ],
  },

  {
    id: "transition",
    name: "Transition to forward flight",
    tag: "Cruise",
    blurb:
      "Hover to cruise. This is where the lift vector lesson stops being theory: the nose goes down, the vertical component shrinks, and the aircraft sinks unless you pay for it.",
    duration: 15,
    loops: false,
    watchFor:
      "Watch the collective climb as the nose drops. That is not a coincidence — it is you buying back the vertical lift you just tilted away.",
    keys: [
      K(0.0, [0, 12, 0], 0, 0, 0, 0.57, [0, 0], -0.12, 0),
      K(0.12, [0, 11.9, 2], 0, -6, 0, 0.58, [0, -0.34], -0.12, 18),
      K(0.26, [0, 11.4, 9], 0, -11, 0, 0.63, [0, -0.5], -0.14, 52),
      K(0.42, [0, 11.6, 24], 0, -12, 0, 0.68, [0, -0.52], -0.15, 95),
      K(0.6, [0, 12.0, 48], 0, -10, 0, 0.7, [0, -0.44], -0.15, 140),
      K(0.8, [0, 12.2, 84], 0, -7, 0, 0.7, [0, -0.3], -0.14, 172),
      K(1.0, [0, 12.2, 126], 0, -5, 0, 0.69, [0, -0.22], -0.13, 186),
    ],
    phases: [
      { at: 0.0, title: "Nose down", detail: "Forward cyclic tilts the disc. The aircraft accelerates because part of the lift now points forward." },
      { at: 0.2, title: "Through the sink", detail: "The vertical component just got smaller, so it starts to descend. Feed in collective to hold height." },
      { at: 0.5, title: "Accelerating", detail: "Speed builds. The aircraft becomes more stable and less pedal is needed as airflow does the work." },
      { at: 0.78, title: "Settle into cruise", detail: "Ease the nose back toward level and hold the attitude that gives the speed you want." },
    ],
  },

  {
    id: "turn",
    name: "Level turn",
    tag: "Cruise",
    blurb:
      "A 180° turn at 30° of bank, holding altitude. The cleanest demonstration of why banking costs you lift.",
    duration: 14,
    loops: false,
    watchFor:
      "At 30° of bank you keep about 87% of your vertical lift, so you need roughly 15% more collective just to stay level. Pilots who do not add it descend through the turn and blame the aircraft.",
    keys: [
    K(0.00, [0, 15, -27.94], 0, -4, 0, 0.62, [0, -0.14], -0.1, 70),
    K(0.06, [0, 15, -13.97], 0, -4, -15, 0.64, [-0.24, -0.14], -0.1, 70),
    K(0.12, [0, 15, 0], 0.1, -4, -30, 0.72, [-0.48, -0.14], -0.1, 70),
    K(0.24, [8.01, 15, 31.63], 28.4, -4, -30, 0.72, [-0.48, -0.14], -0.1, 70),
    K(0.36, [30.11, 15, 55.63], 56.8, -4, -30, 0.72, [-0.48, -0.14], -0.1, 70),
    K(0.50, [66.45, 15, 66.45], 90, -4, -30, 0.72, [-0.48, -0.14], -0.1, 70),
    K(0.64, [102.79, 15, 55.63], 123.2, -4, -30, 0.72, [-0.48, -0.14], -0.1, 70),
    K(0.76, [124.89, 15, 31.63], 151.6, -4, -30, 0.72, [-0.48, -0.14], -0.1, 70),
    K(0.88, [132.9, 15, 0], 179.9, -4, -30, 0.72, [-0.48, -0.14], -0.1, 70),
    K(0.94, [132.9, 15, -13.97], 180, -4, -15, 0.64, [-0.24, -0.14], -0.1, 70),
    K(1.00, [132.9, 15, -27.94], 180, -4, 0, 0.62, [0, -0.14], -0.1, 70),
    ],
    phases: [
      { at: 0.0, title: "Roll in", detail: "Lateral cyclic banks the disc. Nothing else has happened yet — bank alone does not turn you." },
      { at: 0.08, title: "Add collective", detail: "The moment the disc tilts, vertical lift drops. Feed collective in as the bank steepens or you will sink." },
      { at: 0.3, title: "Hold the bank", detail: "Steady 30°. The turn rate comes from the bank angle and the speed, not from the pedals." },
      { at: 0.86, title: "Roll out", detail: "Ease the bank off and take the collective back out at the same rate, or you balloon on the way out." },
    ],
  },

  {
    id: "quickstop",
    name: "Quick stop",
    tag: "Arrival",
    blurb:
      "Fast and low to a standstill in one movement, without climbing. The building block the J-hook is made from.",
    duration: 12,
    loops: false,
    watchFor:
      "The balance is everything: too much nose-up and you balloon into everyone's sights, too little and you arrive at the zone still doing 100 km/h.",
    keys: [
      K(0.0, [0, 6, 0], 0, -8, 0, 0.7, [0, -0.3], -0.13, 200),
      K(0.16, [0, 6, 26], 0, -2, 0, 0.52, [0, 0.1], -0.11, 190),
      K(0.34, [0, 6.3, 52], 0, 12, 0, 0.36, [0, 0.6], -0.09, 150),
      K(0.54, [0, 6.6, 72], 0, 20, 0, 0.3, [0, 0.82], -0.07, 92),
      K(0.72, [0, 6.4, 84], 0, 16, 0, 0.4, [0, 0.6], -0.08, 45),
      K(0.88, [0, 6.1, 89], 0, 6, 0, 0.52, [0, 0.24], -0.1, 14),
      K(1.0, [0, 6, 91], 0, 0, 0, 0.56, [0, 0], -0.12, 0),
    ],
    phases: [
      { at: 0.0, title: "Committed and low", detail: "Arrive with the speed on. This only works if you have energy to trade." },
      { at: 0.14, title: "Collective down", detail: "Lower the collective first. This is what stops you climbing when the nose comes up." },
      { at: 0.3, title: "Raise the nose", detail: "Aft cyclic. The disc tilts back and the rotor starts braking the aircraft against the airflow." },
      { at: 0.68, title: "Cushion", detail: "As the speed washes off, collective back in to catch the sink and level the nose." },
    ],
  },

  {
    id: "pedalturn",
    name: "Pedal turn",
    tag: "Foundation",
    blurb:
      "360° about the mast without moving. The drill that teaches you the tail rotor is a separate control from everything else.",
    duration: 13,
    loops: true,
    watchFor:
      "The cyclic has to keep working the whole way round to hold position, because your reference picture changes continuously. Most people drift badly at 90° and 270°.",
    keys: [
      K(0.0, [0, 3, 0], 0, 0, 0, 0.56, [0, 0], 0, 0),
      K(0.1, [0, 3, 0], 26, 0.4, 0.6, 0.57, [0.06, 0.04], 0.55, 0),
      K(0.3, [0.1, 3, 0.05], 108, 0.6, -0.5, 0.57, [-0.08, 0.05], 0.6, 0),
      K(0.5, [0.05, 3, -0.06], 190, 0.5, 0.6, 0.57, [0.07, 0.04], 0.6, 0),
      K(0.7, [-0.08, 3, 0.04], 268, 0.6, -0.4, 0.57, [-0.06, 0.05], 0.6, 0),
      K(0.9, [0.04, 3, 0.03], 338, 0.4, 0.4, 0.57, [0.05, 0.03], 0.55, 0),
      K(1.0, [0, 3, 0], 360, 0, 0, 0.56, [0, 0], 0, 0),
    ],
    phases: [
      { at: 0.0, title: "Pedal in", detail: "Feed pedal in smoothly. The nose starts round; nothing else should change." },
      { at: 0.25, title: "Hold the spot", detail: "Keep the mast over the same point on the ground with the cyclic while the nose swings." },
      { at: 0.6, title: "Watch the drift", detail: "Halfway round your visual reference is gone. This is where people slide sideways without noticing." },
      { at: 0.88, title: "Stop on heading", detail: "Lead the stop — take the pedal out before the heading you want, or you overshoot it." },
    ],
  },

  {
    id: "jhook",
    name: "J-hook",
    tag: "Arrival",
    blurb:
      "The combat landing: arrive fast and low, fly past the zone, and hook back onto it — trading every bit of airspeed for the turn rather than for altitude.",
    duration: 13,
    loops: false,
    watchFor:
      "Collective goes down at the start and stays down until the cushion. If you pull the nose up instead of banking, all that energy goes into a climb and you hang over the zone as a target.",
    keys: [
    K(0.00, [-90, 16, -160], 0, -6, 0, 0.7, [0, -0.23], 0, 250),
    K(0.08, [-90, 15.05, -127.24], 0, -4.9, 0, 0.27, [0, -0.19], 0, 244),
    K(0.16, [-90, 14.1, -94.48], 0, -3.7, 0, 0.22, [0, -0.14], 0, 239),
    K(0.24, [-90, 13.14, -61.71], 0, -2.6, 0, 0.22, [0, -0.1], 0, 233),
    K(0.32, [-90, 12.19, -28.95], 0, -1.4, 0, 0.22, [0, -0.05], 0, 227),
    K(0.42, [-90, 11, 12], 0.1, 0, -10.4, 0.22, [-0.17, 0], -0.03, 220),
    K(0.50, [-82.86, 10.43, 36.33], 66.5, 3, -37.6, 0.22, [-0.61, 0.11], -0.89, 207),
    K(0.58, [-63.69, 8.95, 52.93], 127.5, 9.1, -48, 0.22, [-0.77, 0.35], -0.02, 175),
    K(0.66, [-38.6, 6.91, 56.54], 145.7, 14.2, -48, 0.22, [-0.77, 0.54], 0.32, 131),
    K(0.74, [-15.53, 4.65, 46.01], 161.3, 15, -48, 0.22, [-0.77, 0.58], 0.33, 83),
    K(0.82, [-1.82, 2.52, 24.68], 175.4, 15, -41.9, 0.22, [-0.68, 0.58], 0.43, 40),
    K(0.88, [0, 1.22, 10.29], 180, 14.2, -20, 0.22, [-0.32, 0.54], 0, 16),
    K(0.94, [0, 0.33, 5.14], 180, 5.9, -1.6, 0.39, [-0.03, 0.23], 0, 2),
    K(1.00, [0, 0, 0], 180, 0, 0, 0.56, [0, 0], 0, 0),
    ],
    phases: [
      { at: 0.0, title: "Arrive alongside, not at, the spot", detail: "Run in fast and low with the zone off your left. Aimed straight at it there is nowhere for the tail to swing." },
      { at: 0.09, title: "Collective down", detail: "Dump it and hold it down until the skids touch. Everything from here is energy you already have." },
      { at: 0.40, title: "Roll toward the zone", detail: "Bank hard into the turn as you come abeam. The lift vector goes sideways, so the energy goes into the turn instead of a climb." },
      { at: 0.50, title: "Pedal swings the tail", detail: "Feed pedal so the tail comes round and the nose stays on the spot — the aircraft drifts around the landing point like a car through a corner." },
      { at: 0.68, title: "Tighten and bleed", detail: "Hold the bank and let the speed wash off. The nose is now up to 78° off the flight path; that skid is what is braking you." },
      { at: 0.86, title: "Roll level and cushion", detail: "Wings level onto a short final, nose to the horizon, collective back in to catch the sink onto the skids." },
    ],
  },
];

export const byId = (id: string) => maneuvers.find((m) => m.id === id) ?? maneuvers[0];
