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
    K(0.000, [-64.07, 15, -49.77], 0, -4, 0, 0.62, [0, -0.14], -0.1, 70),
    K(0.026, [-64.07, 15, -42.77], 0, -4, 0, 0.62, [0, -0.14], -0.1, 70),
    K(0.051, [-64.07, 15, -35.85], 0, -4, 0, 0.62, [0, -0.14], -0.1, 70),
    K(0.077, [-64.06, 15, -28.85], 0.1, -4, -1.3, 0.62, [-0.02, -0.14], -0.1, 70),
    K(0.103, [-64.03, 15, -21.93], 0.7, -4, -6.9, 0.62, [-0.11, -0.14], -0.1, 70),
    K(0.128, [-63.83, 15, -14.94], 2.7, -4, -15, 0.64, [-0.24, -0.14], -0.1, 70),
    K(0.154, [-63.3, 15, -8.03], 6.3, -4, -23.2, 0.67, [-0.37, -0.14], -0.1, 70),
    K(0.179, [-62.23, 15, -1.13], 11.5, -4, -29.3, 0.71, [-0.47, -0.14], -0.1, 70),
    K(0.205, [-60.46, 15, 5.64], 17.7, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.231, [-58, 15, 12.11], 24, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.256, [-54.81, 15, 18.33], 30.3, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.282, [-50.99, 15, 24.1], 36.5, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.308, [-46.52, 15, 29.48], 42.8, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.333, [-41.54, 15, 34.29], 49.1, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.359, [-36.02, 15, 38.56], 55.4, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.385, [-30.11, 15, 42.17], 61.7, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.410, [-23.78, 15, 45.15], 68, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.436, [-17.17, 15, 47.4], 74.3, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.462, [-10.41, 15, 48.91], 80.5, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.487, [-3.46, 15, 49.67], 86.8, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.513, [3.46, 15, 49.67], 93.1, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.538, [10.41, 15, 48.91], 99.4, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.564, [17.17, 15, 47.4], 105.7, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.590, [23.78, 15, 45.15], 112, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.615, [30.11, 15, 42.17], 118.3, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.641, [36.02, 15, 38.56], 124.5, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.667, [41.54, 15, 34.29], 130.8, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.692, [46.52, 15, 29.48], 137.1, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.718, [50.99, 15, 24.1], 143.4, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.744, [54.81, 15, 18.33], 149.7, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.769, [58, 15, 12.11], 156, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.795, [60.46, 15, 5.64], 162.2, -4, -31.1, 0.72, [-0.5, -0.14], -0.1, 70),
    K(0.821, [62.23, 15, -1.13], 168.4, -4, -29.3, 0.71, [-0.47, -0.14], -0.1, 70),
    K(0.846, [63.3, 15, -8.03], 173.6, -4, -23.2, 0.67, [-0.37, -0.14], -0.1, 70),
    K(0.872, [63.83, 15, -14.94], 177.3, -4, -15, 0.64, [-0.24, -0.14], -0.1, 70),
    K(0.897, [64.03, 15, -21.93], 179.3, -4, -6.9, 0.62, [-0.11, -0.14], -0.1, 70),
    K(0.923, [64.06, 15, -28.85], 179.9, -4, -1.3, 0.62, [-0.02, -0.14], -0.1, 70),
    K(0.949, [64.07, 15, -35.85], 180, -4, 0, 0.62, [0, -0.14], -0.1, 70),
    K(0.974, [64.07, 15, -42.77], 180, -4, 0, 0.62, [0, -0.14], -0.1, 70),
    K(1.000, [64.07, 15, -49.77], 180, -4, 0, 0.62, [0, -0.14], -0.1, 70),
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
    K(0.000, [-114.38, 14, -276.32], 0, -5, 0, 0.7, [0, -0.19], 0, 200),
    K(0.020, [-114.38, 13.92, -262.29], 0, -4.8, 0, 0.65, [0, -0.18], 0, 199),
    K(0.039, [-114.38, 13.7, -248.18], 0, -4.2, 0, 0.54, [0, -0.16], 0, 197),
    K(0.059, [-114.38, 13.39, -234.36], 0, -3.5, 0, 0.4, [0, -0.13], 0, 196),
    K(0.078, [-114.38, 13.03, -220.47], 0, -2.6, 0, 0.28, [0, -0.1], 0, 194),
    K(0.098, [-114.38, 12.67, -206.88], 0, -1.7, 0, 0.22, [0, -0.06], 0, 192),
    K(0.118, [-114.38, 12.35, -193.28], 0, -0.9, 0, 0.22, [0, -0.03], 0, 189),
    K(0.137, [-114.38, 12.11, -180.08], 0, -0.3, 0, 0.22, [0, -0.01], 0, 186),
    K(0.157, [-114.38, 12, -167.16], 0, 0, 0, 0.22, [0, 0], 0, 182),
    K(0.176, [-114.38, 11.96, -154.36], 0.4, 0.1, -1.2, 0.22, [-0.02, 0], -0.06, 177),
    K(0.196, [-114.37, 11.86, -142.03], 2.2, 0.3, -5.4, 0.22, [-0.09, 0.01], -0.12, 173),
    K(0.216, [-114.29, 11.71, -129.85], 5.4, 0.6, -11.6, 0.22, [-0.2, 0.02], -0.19, 169),
    K(0.235, [-114.08, 11.52, -118.12], 10.1, 1.1, -18.9, 0.22, [-0.33, 0.04], -0.24, 164),
    K(0.255, [-113.66, 11.3, -106.55], 16.1, 1.8, -26.5, 0.22, [-0.46, 0.07], -0.28, 160),
    K(0.275, [-112.94, 11.05, -95.44], 23.2, 2.5, -33.3, 0.22, [-0.57, 0.1], -0.31, 156),
    K(0.294, [-111.84, 10.77, -84.66], 31, 3.3, -38.6, 0.22, [-0.67, 0.13], -0.31, 152),
    K(0.314, [-110.25, 10.48, -74.11], 39.3, 4.2, -41.3, 0.22, [-0.71, 0.16], -0.29, 147),
    K(0.333, [-108.19, 10.16, -64.09], 47.4, 5.1, -41.5, 0.22, [-0.72, 0.2], -0.27, 143),
    K(0.353, [-105.62, 9.83, -54.37], 55.1, 6.1, -41.5, 0.22, [-0.72, 0.23], -0.23, 139),
    K(0.373, [-102.63, 9.48, -45.21], 62.1, 7.1, -41.5, 0.22, [-0.72, 0.27], -0.19, 135),
    K(0.392, [-99.17, 9.12, -36.42], 68.4, 8.1, -41.5, 0.22, [-0.72, 0.31], -0.12, 130),
    K(0.412, [-95.36, 8.74, -28.23], 73.4, 9.1, -41.5, 0.22, [-0.72, 0.35], -0.04, 126),
    K(0.431, [-91.18, 8.36, -20.56], 77.3, 10.1, -41.5, 0.22, [-0.72, 0.39], -0.01, 122),
    K(0.451, [-86.61, 7.97, -13.34], 81.2, 11.1, -41.5, 0.22, [-0.72, 0.43], -0.01, 118),
    K(0.471, [-81.81, 7.58, -6.78], 85.3, 12, -41.5, 0.22, [-0.72, 0.46], 0, 113),
    K(0.490, [-76.68, 7.18, -0.73], 89.5, 12.9, -41.5, 0.22, [-0.72, 0.5], 0, 109),
    K(0.510, [-71.41, 6.78, 4.65], 93.7, 13.7, -41.5, 0.22, [-0.72, 0.53], 0, 105),
    K(0.529, [-65.9, 6.37, 9.48], 98.2, 14.4, -41.5, 0.22, [-0.72, 0.55], 0, 101),
    K(0.549, [-60.34, 5.97, 13.62], 102.7, 15, -41.5, 0.22, [-0.72, 0.58], 0.01, 96),
    K(0.569, [-54.64, 5.57, 17.17], 107.4, 15.4, -41.5, 0.22, [-0.72, 0.59], 0.01, 92),
    K(0.588, [-49, 5.18, 20.04], 112.2, 15.8, -41.5, 0.22, [-0.72, 0.61], 0.02, 88),
    K(0.608, [-43.4, 4.78, 22.28], 117.2, 16, -41.5, 0.22, [-0.72, 0.61], 0.02, 84),
    K(0.627, [-37.82, 4.4, 23.91], 122.3, 16, -41.5, 0.22, [-0.72, 0.62], 0.03, 79),
    K(0.647, [-32.48, 4.02, 24.91], 127.5, 16, -41.5, 0.22, [-0.72, 0.62], 0.05, 75),
    K(0.667, [-27.3, 3.65, 25.32], 132.8, 16, -41.5, 0.22, [-0.72, 0.62], 0.06, 71),
    K(0.686, [-22.47, 3.29, 25.15], 138.2, 16, -41.5, 0.22, [-0.72, 0.62], 0.08, 67),
    K(0.706, [-17.94, 2.94, 24.44], 143.7, 16, -41.5, 0.22, [-0.72, 0.62], 0.1, 62),
    K(0.725, [-13.87, 2.61, 23.26], 149.2, 16, -41.5, 0.22, [-0.72, 0.62], 0.13, 58),
    K(0.745, [-10.28, 2.29, 21.66], 154.6, 16, -41.5, 0.22, [-0.72, 0.62], 0.17, 54),
    K(0.765, [-7.18, 1.98, 19.69], 160, 16, -41.5, 0.22, [-0.72, 0.62], 0.23, 49),
    K(0.784, [-4.69, 1.69, 17.47], 165, 16, -41.4, 0.22, [-0.71, 0.62], 0.3, 45),
    K(0.804, [-2.79, 1.42, 15.06], 169.5, 16, -38.7, 0.22, [-0.67, 0.62], 0.36, 41),
    K(0.824, [-1.49, 1.17, 12.65], 172.3, 16, -33.1, 0.22, [-0.57, 0.62], 0.4, 37),
    K(0.843, [-0.68, 0.94, 10.32], 174.2, 16, -25.6, 0.22, [-0.44, 0.61], 0.33, 32),
    K(0.863, [-0.25, 0.73, 8.23], 176, 15.1, -17.5, 0.22, [-0.3, 0.58], 0.22, 28),
    K(0.882, [-0.07, 0.55, 6.39], 177.8, 13.2, -9.9, 0.22, [-0.17, 0.51], 0.11, 24),
    K(0.902, [-0.01, 0.39, 4.8], 179.4, 10.7, -3.8, 0.25, [-0.07, 0.41], 0.03, 21),
    K(0.922, [0, 0.25, 3.47], 180, 7.8, -0.4, 0.31, [-0.01, 0.3], 0, 17),
    K(0.941, [0, 0.14, 2.34], 180, 4.9, 0, 0.39, [0, 0.19], 0, 14),
    K(0.961, [0, 0.06, 1.41], 180, 2.4, 0, 0.47, [0, 0.09], 0, 12),
    K(0.980, [0, 0.02, 0.63], 180, 0.7, 0, 0.53, [0, 0.03], 0, 10),
    K(1.000, [0, 0, 0], 180, 0, 0, 0.55, [0, 0], 0, 8),
    ],
    phases: [
      { at: 0.0, title: "Arrive alongside, not at, the spot", detail: "Run in fast and low with the zone off your left. Aimed straight at it there is nowhere for the tail to swing." },
      { at: 0.06, title: "Collective down", detail: "Dump it and hold it down until the skids touch. Everything from here is energy you already have." },
      { at: 0.20, title: "Roll toward the zone", detail: "Bank hard as the spot comes abeam. The lift vector goes sideways, so the energy goes into the turn instead of a climb." },
      { at: 0.34, title: "Pedal swings the tail", detail: "Feed pedal so the tail comes round and the nose stays on the spot — the aircraft drifts around the landing point like a car through a corner." },
      { at: 0.56, title: "Tighten and bleed", detail: "You do not pull harder here. The bank stays put and the turn tightens on its own, because radius follows the square of your speed — 123 m of radius at 118 km/h becomes 36 m at 64 km/h. The nose sits about 45° off the flight path, and that skid is what is braking you." },
      { at: 0.86, title: "Roll level and cushion", detail: "Wings level over the spot, nose to the horizon, collective back in to catch the sink onto the skids." },
    ],
  },
];

export const byId = (id: string) => maneuvers.find((m) => m.id === id) ?? maneuvers[0];
