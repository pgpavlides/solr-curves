import { controls } from "./controls";

/*
  Rotary-wing vocabulary, as used in WARDOGS.

  Most of it is real helicopter terminology the game inherits without ever
  explaining. The framing here leans on Cologne TM, a working pilot with 3,000
  hours on real aircraft, who defines the axes properly in his WARDOGS
  tutorials — see /guides/j-hook-cologne/.
*/

export type Group =
  | "The controls"
  | "Attitude and forces"
  | "Maneuvers"
  | "Instruments and readouts"
  | "Tactical";

export const GROUPS: Group[] = [
  "The controls",
  "Attitude and forces",
  "Maneuvers",
  "Instruments and readouts",
  "Tactical",
];

export interface Term {
  term: string;
  group: Group;
  def: string;
  /** the word people actually get wrong, or the trap in it */
  note?: string;
}

export const glossary: Term[] = [
  /* ---------------------------------------------------------- controls */
  {
    term: "Collective",
    group: "The controls",
    def: "The lever at the pilot's left hand. It changes the pitch angle of every main rotor blade at once — <strong>collectively</strong>, which is where the name comes from — so it changes how much total lift the rotor makes. <strong>Controls altitude and total power.</strong>",
    note: "It is not a throttle. Treating it like the accelerator in a car is the most common beginner error.",
  },
  {
    term: "Cyclic",
    group: "The controls",
    def: "The stick between the pilot's knees. It changes each blade's pitch <strong>cyclically</strong> — once per revolution — which tilts the whole rotor disc. Tilt the disc and you tilt the lift, and the aircraft goes that way.",
    note: "Fore and aft is airspeed. Left and right is how you turn.",
  },
  {
    term: "Cyclic X / Cyclic Y",
    group: "The controls",
    def: "WARDOGS' own names in the keybind menu. <strong>X is pitch</strong> (nose up and down); <strong>Y is roll</strong> (bank left and right).",
    note: "The menu never uses the words “pitch” or “roll”, which trips up almost everyone the first time.",
  },
  {
    term: "Yaw / pedals / anti-torque",
    group: "The controls",
    def: "The tail rotor, worked by foot pedals in a real aircraft. It swings the nose left and right about the vertical axis <em>without</em> changing where the aircraft is travelling.",
    note: "Its real job is anti-torque: the main rotor tries to spin the fuselage the other way, and the tail rotor cancels that out.",
  },

  /* ------------------------------------------------- attitude and forces */
  {
    term: "Rotor disc",
    group: "Attitude and forces",
    def: "The circle the blades sweep out. Almost every explanation of helicopter flight is really a statement about which way the disc is tilted.",
  },
  {
    term: "Lift vector",
    group: "Attitude and forces",
    def: "The single force the rotor makes, pointing straight out of the disc. Tilt the disc and that force splits into a vertical part still holding you up and a horizontal part pulling you along.",
    note: "You always lose vertical lift when you bank. Everything else follows from this.",
  },
  {
    term: "Attitude",
    group: "Attitude and forces",
    def: "The aircraft's angle relative to the horizon — nose attitude (pitch) and banked attitude (roll).",
  },
  {
    term: "Bank",
    group: "Attitude and forces",
    def: "Rolling the aircraft so the disc tilts to one side. Bank is what turns a helicopter; the pedals only point the nose.",
  },
  {
    term: "Spilling lift",
    group: "Attitude and forces",
    def: "Tilting the disc so far that too much of the lift points sideways and the aircraft sinks or dives in that direction.",
  },
  {
    term: "Inertia",
    group: "Attitude and forces",
    def: "Speed resists a change of direction. Rule of thumb: <strong>double the speed and the turn radius roughly quadruples.</strong>",
  },
  {
    term: "Crab",
    group: "Attitude and forces",
    def: "Flying with the nose pointed somewhere other than the direction of travel. A large deliberate crab is what makes a J-hook brake so hard — the fuselage is presented to the airflow.",
  },
  {
    term: "Slip / skid",
    group: "Attitude and forces",
    def: "<strong>Slip</strong> is yaw opposite the bank; <strong>skid</strong> is yaw into the bank. Both point the nose independently of the turn.",
    note: "Not to be confused with the skids, which are the landing gear.",
  },
  {
    term: "Weathercocking",
    group: "Attitude and forces",
    def: "The nose wanting to swing back into the relative airflow, like a weathervane. Very obvious in backwards flight.",
  },
  {
    term: "Correlation",
    group: "Attitude and forces",
    def: "Cologne TM's word for the link between what your hands do and what the aircraft does. Building it is the actual point of the practice drills.",
  },

  /* -------------------------------------------------------- maneuvers */
  {
    term: "Flare",
    group: "Maneuvers",
    def: "Raising the nose near the ground to bleed off speed without climbing. Collective down, nose up just enough to hold height while the speed washes off.",
    note: "Also the countermeasure you fire at a missile. Context tells you which.",
  },
  {
    term: "J-hook",
    group: "Maneuvers",
    def: "Arrive fast and low <em>alongside</em> the landing zone, dump the collective, roll toward the spot and hold pedal so the tail swings while the nose stays on it. The turn is the airbrake.",
    note: "Because the radius follows the square of your speed, the turn tightens on its own as you slow — which is why it draws a J and not a circle.",
  },
  {
    term: "Quick stop",
    group: "Maneuvers",
    def: "Fast and low to a standstill in one movement without climbing. The building block a J-hook is made from.",
  },
  {
    term: "Run-on landing",
    group: "Maneuvers",
    def: "Landing with a little forward or backward speed still on and sliding to a stop. Has to be slow or you break the airframe.",
  },
  {
    term: "Pedestal landing",
    group: "Maneuvers",
    def: "Setting down on a raised surface — a rooftop or a tower.",
    note: "Height perception is badly skewed without nearby ground references, so expect to over- or undershoot.",
  },
  {
    term: "Turning about a point",
    group: "Maneuvers",
    def: "Flying a constant-radius circle around a fixed object while holding the nose on it with the pedals. Cologne TM rates it the single best all-round drill — it is also exactly the gunship orbit.",
  },
  {
    term: "Nap of the earth",
    group: "Maneuvers",
    def: "Flying down in the terrain rather than above it, using ground and buildings to break line of sight. Also called <strong>terrain masking</strong>.",
  },

  /* ------------------------------------------- instruments and readouts */
  {
    term: "AGL / ASL",
    group: "Instruments and readouts",
    def: "<strong>Above ground level</strong> — use it for drops and crates. <strong>Above sea level</strong> — use it for terrain and obstacle clearance.",
    note: "AGL changes as the ground rises underneath you. It is the one to fly by.",
  },
  {
    term: "Pitch ladder",
    group: "Instruments and readouts",
    def: "The attitude scale in the middle of the HUD. The arrows slide down the ladder as the nose drops.",
    note: "For maximum speed run near the bottom notch — not the very bottom, or you descend.",
  },
  {
    term: "Collective indicator",
    group: "Instruments and readouts",
    def: "The vertical bar low on the HUD. Rising means a climbing input, falling means descending, and centred means you are holding what you have.",
  },
  {
    term: "Bingo fuel",
    group: "Instruments and readouts",
    def: "The fuel state at which you have to turn for home.",
    note: "Landing at main base refuels and repairs automatically.",
  },

  /* --------------------------------------------------------- tactical */
  {
    term: "LZ",
    group: "Tactical",
    def: "Landing zone. Choosing a good one matters more than flying the approach perfectly.",
  },
  {
    term: "Hot zone",
    group: "Tactical",
    def: "The contested objective area. Everything you do inside it pays double, passenger drops included.",
  },
  {
    term: "FOB",
    group: "Tactical",
    def: "Forward operating base. What your supply runs feed, and what the enemy mortars strip of building supplies.",
  },
  {
    term: "Rifle aim",
    group: "Tactical",
    def: "The community's name for putting yaw on the mouse, so you point the aircraft's nose the way you would point a rifle.",
  },
];

/** Stable anchor id for a term — `/terminology/#crab`. */
export const termId = (term: string) =>
  term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const byGroup = (g: Group) => glossary.filter((t) => t.group === g);

/*
  The terms that get their own definition entry.

  The four controls are set out at full length on the terminology page, so
  their short glossary entries would be a second, worse copy of the same words:
  the whole "The controls" group, plus anything sharing a name with a control.
  That last clause is not hypothetical — "Lift vector" is both a control and a
  glossary term, and rendering both gave two elements the same #lift-vector id.

  Deriving it here rather than in the page means the count in the header and
  the count in the filter toolbar cannot disagree.
*/
const controlNames = new Set(controls.map((c) => c.name.toLowerCase()));
export const listedTerms = glossary.filter(
  (t) => t.group !== "The controls" && !controlNames.has(t.term.toLowerCase())
);

/** Everything the terminology page actually shows: controls + listed terms. */
export const termCount = controls.length + listedTerms.length;
