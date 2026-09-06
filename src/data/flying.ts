export interface Drill {
  title: string;
  detail: string;
}

/** A real progression — each drill assumes the one before it. */
export const drills: Drill[] = [
  {
    title: "Lift and set down",
    detail:
      "One metre up, hover, land. Ten times. You are learning what neutral collective looks like on the HUD bar.",
  },
  {
    title: "Hover-taxi a straight line",
    detail:
      "Line up on the train tracks facing east or west and hover along them, slowly at first, then faster. You are building the reflex loop between input and response.",
  },
  {
    title: "Accelerate, stop, land",
    detail:
      "Nose down to build speed, nose up to kill it, come to a complete stop in the air, then land. Notice how much collective you have to add when the nose drops.",
  },
  {
    title: "Bank and level",
    detail:
      "Gentle banks side to side at cruise speed, working up in angle. Then combine with nose up/down, then add collective, then add yaw into the turn.",
  },
  {
    title: "Turns about a point",
    detail:
      "Pick a tower. Fly a constant-radius circle around it, holding the nose on it with yaw the whole way, at constant altitude and constant distance. The single best all-round drill — it is also exactly the gunship orbit.",
  },
  {
    title: "The flare",
    detail:
      "Full speed, low, down the tracks. Dump collective and hold it down. Raise the nose just enough that you neither balloon upward nor sink into the ground, and hold that balance while the speed bleeds to nothing.",
  },
  {
    title: "The J-hook",
    detail: "Once the flare is comfortable, add the turn.",
  },
  {
    title: "Backwards flight",
    detail:
      "Teaches weathercocking and how much yaw it takes to hold a heading. Note the backwards speed cap is much lower.",
  },
  {
    title: "Stop or hop",
    detail:
      "Approach an obstacle and either stop short of it or hop it. Then land in confined spaces between structures — that is where you will actually be putting troops.",
  },
];

export const jhookSteps: string[] = [
  "<strong>Arrive fast and low.</strong> As much speed as you can carry, hugging the terrain. Start the manoeuvre about 200&nbsp;m out.",
  "<strong>Collective all the way down</strong> — and hold it down for the entire manoeuvre.",
  "<strong>Roll toward the LZ.</strong> If the zone is off your left, roll left.",
  "<strong>Hold yaw in the same direction</strong> so the nose stays pointed at the spot the whole way round. You are flying a J: past the zone, then hooking back onto it.",
  "<strong>Tighten the bank and pull</strong> as the speed comes off — trading airspeed and altitude against each other until you are in a low-energy state.",
  "<strong>Level the nose and cushion</strong> with collective up as you settle into the hover.",
];

export const jhookMistakes: string[] = [
  "<strong>Too much altitude at entry</strong> — you end up high and slow over the LZ, the worst possible place to be.",
  "<strong>Pitching up at a bad angle</strong> mid-hook — you shoot skyward and hang there as a target.",
  "<strong>Starting too late.</strong> Double your speed and your turn radius roughly quadruples. Begin the deceleration well before the zone.",
];

export const survival: string[] = [
  "<strong>Terrain-mask.</strong> Nap-of-the-earth flight — hugging hills, using buildings — makes you very hard to acquire. It is a high-risk profile though: you cannot see the battlefield while you are down in it, so use it on the approach, not on the transit out from base.",
  "<strong>Never fly a predictable straight line</strong> at constant altitude between two points.",
  "<strong>Do not hover exposed.</strong> A hovering helicopter is a target that has stopped solving its own problem.",
  "<strong>Mortars kill helicopters outright.</strong> A round landing on you in a hot zone is an instant loss of the airframe and everyone in it.",
  "<strong>Flares:</strong> free-look and find the missile before you commit. Deploy once it is in the air — too early and it re-acquires you, too late and it does not matter. Flying low can also make a missile hit terrain instead of you.",
  "<strong>Buy enough countermeasures</strong> to get in <em>and</em> get home, not just in.",
  "<strong>Slopes bite.</strong> If the airframe is not parallel to the surface you touch, you slide or roll over.",
  "<strong>Tree tops mostly have no collision</strong> in the current build — you can settle down through the canopy. Expect that to change.",
];
