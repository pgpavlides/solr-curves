/*
  Maneuvers, as authored timelines rather than a physics simulation.

  A guide has to show the *correct* execution every time — repeatable, and with
  the stick and pedal positions that produce it. A physics sim would wander, and
  the whole point here is that you can watch the inputs and the aircraft at the
  same moment.

  Frame of reference matches the exported model: +X right, +Y up, +Z is the
  nose. Positions are metres, angles degrees, control inputs normalised.
*/

export interface Key {
  /** 0..1 through the maneuver */
  t: number;
  /** world position, metres */
  p: [number, number, number];
  /** heading in degrees; 0 = nose along +Z, positive = yaw right */
  hdg: number;
  /** nose-up positive */
  pitch: number;
  /** right-bank positive */
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
    duration: 16,
    loops: false,
    watchFor:
      "At 30° of bank you keep about 87% of your vertical lift, so you need roughly 15% more collective just to stay level. Pilots who do not add it descend through the turn and blame the aircraft.",
    keys: [
      K(0.0, [0, 15, 0], 0, -5, 0, 0.68, [0, -0.2], -0.12, 165),
      K(0.12, [0, 15, 18], 4, -5, 14, 0.7, [0.3, -0.16], -0.08, 162),
      K(0.26, [3, 15, 36], 26, -4, 30, 0.74, [0.34, -0.06], -0.04, 155),
      K(0.45, [16, 15, 52], 74, -3, 32, 0.75, [0.32, -0.02], -0.02, 150),
      K(0.64, [36, 15, 56], 122, -3, 32, 0.75, [0.32, -0.02], -0.02, 150),
      K(0.8, [54, 15, 46], 158, -4, 26, 0.73, [0.28, -0.06], -0.04, 155),
      K(0.92, [64, 15, 30], 176, -5, 10, 0.7, [0.12, -0.16], -0.08, 162),
      K(1.0, [68, 15, 16], 180, -5, 0, 0.68, [0, -0.2], -0.12, 165),
    ],
    phases: [
      { at: 0.0, title: "Roll in", detail: "Lateral cyclic banks the disc. Nothing else has happened yet — bank alone does not turn you." },
      { at: 0.2, title: "Add collective", detail: "The moment the disc tilts, vertical lift drops. Feed collective in as the bank steepens or you will sink." },
      { at: 0.45, title: "Hold the bank", detail: "Steady 30°. The turn rate comes from the bank angle and the speed, not from the pedals." },
      { at: 0.82, title: "Roll out", detail: "Ease the bank off and take the collective back out at the same rate, or you balloon on the way out." },
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
    duration: 17,
    loops: false,
    watchFor:
      "Collective goes down at the start and stays down until the cushion. If you pull the nose up instead of banking, all that energy goes into a climb and you hang over the zone as a target.",
    keys: [
      K(0.0, [-26, 14, 34], 218, -8, 0, 0.7, [0, -0.28], -0.13, 245),
      K(0.14, [-16, 11.5, 24], 218, -6, -6, 0.42, [-0.16, -0.1], -0.16, 238),
      K(0.28, [-7, 9.0, 15], 214, -2, -26, 0.26, [-0.4, 0.16], -0.28, 220),
      K(0.42, [2, 7.0, 6], 196, 2, -42, 0.22, [-0.6, 0.3], -0.42, 190),
      K(0.56, [8, 5.5, -3], 158, 6, -46, 0.22, [-0.64, 0.42], -0.5, 150),
      K(0.68, [9, 4.4, -11], 112, 10, -40, 0.26, [-0.54, 0.5], -0.46, 108),
      K(0.79, [5, 3.4, -15], 66, 12, -24, 0.34, [-0.3, 0.52], -0.34, 64),
      K(0.88, [1.5, 2.4, -12], 30, 9, -8, 0.46, [-0.1, 0.38], -0.2, 30),
      K(0.95, [0.2, 1.2, -5], 8, 3, -2, 0.55, [0, 0.14], -0.14, 10),
      K(1.0, [0, 0, 0], 0, 0, 0, 0.5, [0, 0], -0.12, 0),
    ],
    phases: [
      { at: 0.0, title: "Arrive fast and low", detail: "All the speed you can carry, hugging the terrain. Start the manoeuvre about 200 m out." },
      { at: 0.12, title: "Collective down", detail: "Dump it and hold it down. Everything from here is energy you already have." },
      { at: 0.26, title: "Roll toward the zone", detail: "Bank hard into the turn. The lift vector goes sideways, so the energy goes into the turn instead of a climb." },
      { at: 0.52, title: "Yaw holds the nose on the spot", detail: "Pedal keeps the nose pointed at the landing zone the whole way round, so you can see what you are landing into." },
      { at: 0.74, title: "Tighten and bleed", detail: "More bank and aft cyclic as the speed comes off, trading airspeed against altitude." },
      { at: 0.9, title: "Level and cushion", detail: "Roll level, nose to the horizon, collective back in to catch the sink onto the skids." },
    ],
  },
];

export const byId = (id: string) => maneuvers.find((m) => m.id === id) ?? maneuvers[0];
