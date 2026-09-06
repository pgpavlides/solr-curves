export interface Term {
  term: string;
  def: string;
}

export const glossary: Term[] = [
  {
    term: "Collective",
    def: "Lever that changes all rotor blades' pitch together. <strong>Controls altitude and total power.</strong>",
  },
  {
    term: "Cyclic",
    def: "Stick that tilts the rotor disc. <strong>Controls direction</strong> — fore/aft is airspeed, left/right is turning.",
  },
  {
    term: "Cyclic X / Cyclic Y",
    def: "WARDOGS' names in the keybind menu. <strong>X = pitch</strong> (nose up/down), <strong>Y = roll</strong> (bank left/right).",
  },
  {
    term: "Yaw / pedals",
    def: "Tail rotor. Swings the nose without changing your flight path. Also called <strong>anti-torque</strong>.",
  },
  {
    term: "Attitude",
    def: "The aircraft's angle relative to the horizon — nose attitude (pitch) and banked attitude (roll).",
  },
  {
    term: "Lift vector",
    def: "The single force out of the rotor disc. Tilting the disc splits it into vertical and horizontal parts — <strong>you always lose vertical lift when you bank.</strong>",
  },
  {
    term: "Flare",
    def: "Nose-up attitude near the ground to bleed off speed without climbing. Also the countermeasure — context tells you which.",
  },
  {
    term: "J-hook",
    def: "Fast, low arrival that turns hard back onto the LZ, trading all your airspeed for the turn. The standard combat landing.",
  },
  {
    term: "Run-on landing",
    def: "Landing with a little forward or backward speed still on, sliding to a stop. Must be slow or you break the airframe.",
  },
  {
    term: "Pedestal landing",
    def: "Setting down on a raised surface — a tower or roof. Height perception is badly skewed without ground references nearby, so expect to over- or undershoot.",
  },
  {
    term: "AGL / ASL",
    def: "<strong>Above ground level</strong> — use for drops and crates. <strong>Above sea level</strong> — use for terrain and obstacle clearance.",
  },
  {
    term: "Pitch ladder",
    def: "HUD attitude scale. Arrows slide down the ladder as the nose drops. For maximum speed, run near the bottom notch — not the very bottom, or you will descend.",
  },
  {
    term: "Weathercocking",
    def: "The nose wanting to swing back into the relative airflow. Very obvious in backwards flight.",
  },
  {
    term: "Slip / skid",
    def: "<strong>Slip</strong> = yaw opposite the bank. <strong>Skid</strong> = yaw into the bank. Both point the nose independently of the turn.",
  },
  {
    term: "Nap of the earth",
    def: "Tactical flight profile down in the terrain. Enables <strong>terrain masking</strong> — using ground and buildings to break line of sight from anti-air.",
  },
  {
    term: "Inertia",
    def: "Speed resists direction change. Rule of thumb: <strong>double the speed, quadruple the turn radius.</strong>",
  },
  {
    term: "Bingo fuel",
    def: "The fuel state at which you must turn for home. Landing at main base refuels and repairs automatically.",
  },
  { term: "LZ", def: "Landing zone." },
  {
    term: "Rifle aim",
    def: "Community name for the yaw-on-mouse setup — you point the aircraft's nose the way you would point a rifle.",
  },
];
