export interface SettingRow {
  setting: string;
  does: string;
  use: string;
  /** true when every source agrees — rendered at full foreground luminance */
  consensus?: boolean;
}

/** Settings → Controls → rotary / air vehicle block. */
export const flightSettings: SettingRow[] = [
  {
    setting: "Rotary Vehicle Mouse Control",
    does: "Lets the mouse drive two of the flight axes",
    use: "Enabled — universal",
    consensus: true,
  },
  {
    setting: "Helicopter Mouse Swipe Left/Right",
    does: "Assigns the horizontal mouse axis",
    use: "<b>Roll</b> or <b>Yaw</b> — the one real split",
  },
  {
    setting: "Helicopter Mouse Swipe Up/Down",
    does: "Assigns the vertical mouse axis",
    use: "Pitch — nobody disagrees",
    consensus: true,
  },
  {
    setting: "Pitch / Roll / Yaw sensitivity",
    does: "Per-axis mouse gain",
    use: "30% (novice) · 50% @800 DPI · 80% · 90%",
  },
  {
    setting: "Invert Y Axis (Air Vehicles)",
    does: "Pull back = nose up, like a stick",
    use: "Widely recommended; personal",
  },
  {
    setting: "Helicopter Mouse Axis Isolation",
    does: "Suppresses input on the off-axis so small movements stay on one axis. At 100% you can <em>only</em> move straight up/down or straight left/right.",
    use: "Contested: 70% helps steadiness, 0% keeps rifle-aim fluid",
  },
  {
    setting: "Air Vehicle Sensitivity Multiplier",
    does: "Scales flight sensitivity against your global mouse sensitivity",
    use: "Leave until the per-axis numbers feel right",
  },
  {
    setting: "Flight assist / stability assist",
    does: "Auto-levels the aircraft when the stick is centred",
    use: "On to learn; experienced pilots turn it <b>off</b> for consistency",
  },
];

export interface MouseCamp {
  axis: string;
  feels: string;
  bestFor: string;
  cost: string;
}

export const mouseCamps: MouseCamp[] = [
  {
    axis: "Roll",
    feels: "Battlefield 6 helicopters",
    bestFor: "Transitioning from Battlefield; smooth banking turns",
    cost: "Yaw lives on keys, so gun aiming is coarse",
  },
  {
    axis: "Yaw (&ldquo;rifle aim&rdquo;)",
    feels: "Aiming the aircraft like a rifle",
    bestFor: "Miniguns, rockets, gunship orbits, precise nose control",
    cost: "Roll on keys; steeper learning curve",
  },
];
