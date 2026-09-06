export interface Control {
  name: string;
  tag: string;
  real: string[];
  inGame: string;
}

/** The four things every maneuver reduces to. */
export const controls: Control[] = [
  {
    name: "Collective",
    tag: "Altitude · Power",
    real: [
      "The lever at the pilot's left hand. It changes the pitch angle of <em>all</em> the main rotor blades at once — collectively, all the way around the circle — so it changes how much total lift the rotor makes. Pull up: more blade bite, more lift, you climb. Push down: less lift, you sink.",
      "This is your <strong>altitude and total energy</strong> control. It is not your speed control, and treating it like a throttle in a car is the single most common beginner error.",
    ],
    inGame:
      "Two keys, raise and lower. Holding raise from cold also spins the engine up — that <strong>is</strong> the start sequence. Watch the vertical bar low on the HUD: bar rising = climbing input, bar falling = descending, bar at neutral = holding altitude.",
  },
  {
    name: "Cyclic",
    tag: "Pitch & Roll · Direction",
    real: [
      "The stick between the pilot's knees. It changes each blade's pitch cyclically — once per revolution — which tilts the whole rotor disc. Tilt the disc and you tilt the lift, and the aircraft goes that way.",
      "Fore/aft is <strong>pitch</strong>: nose down accelerates, nose up decelerates — this is your airspeed control. Left/right is <strong>roll</strong> (bank) — this is how you turn.",
    ],
    inGame:
      "The keybind menu calls these <strong>Increase / Decrease Cyclic X</strong> (pitch, nose up/down) and <strong>Increase / Decrease Cyclic Y</strong> (roll, left/right). It never uses the words &ldquo;pitch&rdquo; or &ldquo;roll&rdquo;, which trips up everybody the first time.",
  },
  {
    name: "Yaw",
    tag: "Pedals · Tail rotor",
    real: [
      "The tail rotor, worked by foot pedals in the real aircraft. It swings the nose left and right about the vertical axis <em>without</em> changing where the aircraft is travelling. Its real job is anti-torque: the main rotor tries to spin the fuselage the opposite way, and the tail rotor cancels that out.",
      "Practically, yaw is how you keep your guns on a target while flying sideways past it, and it is half of a J-hook.",
    ],
    inGame:
      "Either two keys or a mouse swipe axis. Keys give you fast, committed turns; the mouse gives you fine aim. Several pilots bind both.",
  },
  {
    name: "Lift vector",
    tag: "Not a control — the reason",
    real: [
      "The rotor only makes force in one direction: straight out of the disc, perpendicular to it. When the disc is level, all of that force holds you up. The moment you bank or pitch, that force splits into a <strong>vertical component</strong> (still holding you up) and a <strong>horizontal component</strong> (dragging you forward or sideways) — and the vertical half just got smaller.",
      "So <strong>every bank and every nose-down attitude costs you altitude</strong> unless you add collective or raise the nose. Tilt far enough and you spill so much lift you simply dive that way. That one fact explains ballooning on approach, sinking in turns, and why a J-hook works.",
    ],
    inGame:
      "Nothing to bind. This is the model the whole aircraft runs on, and the reason the game punishes big inputs.",
  },
];
