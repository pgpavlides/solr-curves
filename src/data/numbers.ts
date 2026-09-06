export interface DropRow {
  band: string;
  agl: string;
  outcome: string;
  /** 1 = safe, 2 = degraded, 3 = fatal. Rendered as luminance, never hue. */
  sev: 1 | 2 | 3;
}

export const dropHeights: DropRow[] = [
  {
    band: "Safe",
    agl: "≤ 5 m",
    outcome: "No damage. Everybody walks away. Aim for this.",
    sev: 1,
  },
  { band: "Marginal", agl: "7 m", outcome: "They start taking fall damage.", sev: 2 },
  {
    band: "Bad",
    agl: "8 m",
    outcome: "≈40 HP left. Dropped into a fight at 40 HP, they die.",
    sev: 2,
  },
  {
    band: "Fatal",
    agl: "9–10 m",
    outcome: "Death. You just killed your own squad and your payout.",
    sev: 3,
  },
];

export interface CrateRow {
  crate: string;
  maxDrop: string;
  protection: string;
  notes: string;
}

export const crates: CrateRow[] = [
  {
    crate: "Small crate",
    maxDrop: "60 m AGL",
    protection: "Unarmoured — destroyed by bullets and explosives",
    notes: "Available from the start",
  },
  {
    crate: "Small armoured crate",
    maxDrop: "80 m AGL",
    protection: "Resistant to bullets and explosives",
    notes: "Unlocked through pilot progression; worth it on the front line",
  },
];

export const payouts = [
  "<strong>~$165 per teammate</strong> deployed the moment they step off the aircraft.",
  "<strong>Paid again</strong> if they are still alive roughly 20 seconds later.",
  "<strong>Assist share</strong> on their kills afterwards, passively.",
  "<strong>Tips</strong> from passengers who liked the ride.",
  "<strong>Tactical deployment bonus</strong> on top, for dropping people into a zone while you are actually under fire.",
];
