export interface SupplyRow {
  supply: string;
  feeds: string;
  demand: string;
}

export const supplies: SupplyRow[] = [
  {
    supply: "Building supplies",
    feeds: "The FOB itself and everything structural",
    demand:
      "Heaviest at match start — and again mid-match, because enemy mortars strip FOBs of them fast",
  },
  {
    supply: "Ammo",
    feeds: "Mortar pits, SAM sites",
    demand: "As soon as your team starts putting emplacements up",
  },
  {
    supply: "Mechanical supplies",
    feeds: "Advanced structures — C-RAM, drills",
    demand: "Mid-game, once the basic base is standing",
  },
  {
    supply: "Fuel",
    feeds: "Runs the drills that pull the zone toward you; also FOB refuel points",
    demand: "Late — but it is what actually wins ground, so do not neglect it",
  },
  {
    supply: "Meds",
    feeds: "Infantry in contact",
    demand: "Always, at the front line — best return of anything you carry",
  },
];

export const habits: string[] = [
  "<strong>Unlock the aircraft</strong> before you spool up. Everyone forgets. People will stand next to a locked helicopter shouting at you.",
  "<strong>Join a squad.</strong> Comms are the difference between landing at a FOB and landing at a FOB that was overrun ninety seconds ago.",
  "<strong>Ping your destination</strong> — it puts a 3D marker in the world, not just on the map, so you can fly to it heads-up.",
  "<strong>Say where you are going.</strong> &ldquo;Dropping supplies at the rear FOB, then I will fly over the point if you have a chute&rdquo; turns a confused passenger into a repeat customer.",
  "<strong>Tell people they can jump.</strong> They will sit there until you touch the skids down unless you say otherwise.",
  "<strong>Honk when you leave</strong> after a supply drop, so ground troops know where you left the crates.",
];
