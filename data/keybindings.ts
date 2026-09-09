/*
  Every sane way to bind a WARDOGS helicopter.

  Four things have to go somewhere — collective, pitch, roll, yaw — and there
  are only so many places to put them. This file is that space, laid out
  rather than argued about, so somebody can look down the page and find the
  one they already fly, or the one they are about to try.

  The organising fact is that pitch is always on the mouse's vertical axis when
  the mouse is flying at all. Nobody disagrees about that. Everything else
  follows from two questions:

    1. is the mouse flying the aircraft, or only aiming the guns?
    2. if it is flying, does horizontal mean ROLL or YAW?

  Roll gives you a machine that banks like every other shooter. Yaw gives you a
  nose you can aim like a rifle, which shoots better and takes longer to learn.
  That single choice sorts most of the layouts below.

  `seen` is only set where the layout was actually observed in someone's video
  — read off the game's own settings screen, or said out loud on camera. It is
  evidence that a layout is in real use, not the reason it is listed. A layout
  with no `seen` is still a real layout; it just has not been caught on camera
  here yet.
*/

export type Family = "Mouse flies" | "Keyboard only" | "Hardware";

export const FAMILIES: { name: Family; blurb: string }[] = [
  {
    name: "Mouse flies",
    blurb:
      "Rotary Vehicle Mouse Control enabled. The mouse takes pitch and one other axis; the keyboard takes what is left. This is what most people run.",
  },
  {
    name: "Keyboard only",
    blurb:
      "Mouse control off, every axis on a key. You lose fine, analogue control and you gain an aircraft that does exactly the same thing every time — and a mouse free to aim.",
  },
  {
    name: "Hardware",
    blurb:
      "A stick, a throttle or a pad. Genuinely analogue on all four axes, which no keyboard can be.",
  },
];

export interface Bind {
  fn: string;
  key: string;
}

/** Where a layout was actually observed, when it has been. */
export interface Seen {
  who: string;
  channelUrl?: string;
  videoId: string;
  at: number;
  clock: string;
  /** true when the game's own settings screen was on camera */
  fromMenu: boolean;
}

export interface Layout {
  id: string;
  name: string;
  family: Family;
  /** what a horizontal mouse movement does */
  mouse: "Roll" | "Yaw" | "Not used";
  suits: string;
  /** the price you pay for it */
  cost: string;
  binds: Bind[];
  seen?: Seen;
}

/*
  Every layout lists the same five rows in the same order, so two of them can
  be read side by side without hunting for the matching line.
*/
export const layouts: Layout[] = [
  /* ------------------------------------------------------- mouse flies */
  {
    id: "mouse-roll-wasd",
    name: "Mouse roll · WASD",
    family: "Mouse flies",
    mouse: "Roll",
    suits:
      "Coming from Battlefield or any other shooter with helicopters. The aircraft banks where you point and the collective sits where the throttle used to be.",
    cost:
      "Yaw is on keys, so the nose moves in steps. Gun work is coarse — fine for rockets, poor for a minigun.",
    binds: [
      { fn: "Collective raise / lower", key: "W / S" },
      { fn: "Pitch — cyclic X", key: "Mouse up / down" },
      { fn: "Roll — cyclic Y", key: "Mouse left / right" },
      { fn: "Yaw left / right", key: "A / D" },
      { fn: "Free look", key: "L Alt" },
    ],
    seen: {
      who: "Your Chopper Pilot",
      channelUrl: "https://www.youtube.com/@YourChopperPilot",
      videoId: "RvDm0GMj0x0",
      at: 140,
      clock: "2:20",
      fromMenu: false,
    },
  },
  {
    id: "mouse-yaw-wasd",
    name: "Mouse yaw · WASD",
    family: "Mouse flies",
    mouse: "Yaw",
    suits:
      "Gunships and anything with a minigun. The nose becomes the crosshair, so you fly the aircraft by aiming it.",
    cost:
      "Roll is on keys, so banking is stepped and coordinated turns take practice. The harder of the two to learn, and the one that shoots.",
    binds: [
      { fn: "Collective raise / lower", key: "W / S" },
      { fn: "Pitch — cyclic X", key: "Mouse up / down" },
      { fn: "Roll — cyclic Y", key: "A / D" },
      { fn: "Yaw left / right", key: "Mouse left / right" },
      { fn: "Free look", key: "L Alt" },
    ],
    seen: {
      who: "VGAIN",
      videoId: "Wg9ve3wWJ_E",
      at: 60,
      clock: "1:00",
      fromMenu: true,
    },
  },
  {
    id: "mouse-roll-left-hand",
    name: "Mouse roll · left-hand collective",
    family: "Mouse flies",
    mouse: "Roll",
    suits:
      "Anyone who wants the collective where a real one is — under the left hand, on its own, not sharing keys with anything else.",
    cost:
      "Shift and Ctrl are worse than W and S for holding a steady climb rate, and you give up whatever you had bound to them.",
    binds: [
      { fn: "Collective raise / lower", key: "L Shift / L Ctrl" },
      { fn: "Pitch — cyclic X", key: "Mouse up / down" },
      { fn: "Roll — cyclic Y", key: "Mouse left / right" },
      { fn: "Yaw left / right", key: "A / D" },
      { fn: "Free look", key: "L Alt" },
    ],
  },
  {
    id: "mouse-yaw-left-hand",
    name: "Mouse yaw · left-hand collective",
    family: "Mouse flies",
    mouse: "Yaw",
    suits:
      "The rifle-aim split with the collective off WASD, which leaves A and D free for roll and keeps the whole left hand on flying.",
    cost: "Same as above, plus the steeper yaw-on-mouse learning curve.",
    binds: [
      { fn: "Collective raise / lower", key: "L Shift / L Ctrl" },
      { fn: "Pitch — cyclic X", key: "Mouse up / down" },
      { fn: "Roll — cyclic Y", key: "A / D" },
      { fn: "Yaw left / right", key: "Mouse left / right" },
      { fn: "Free look", key: "L Alt" },
    ],
  },
  {
    id: "mouse-roll-thumb-yaw",
    name: "Mouse roll · thumb yaw",
    family: "Mouse flies",
    mouse: "Roll",
    suits:
      "A mouse with side buttons. Roll stays analogue on the mouse and yaw moves to the thumb, so both hands keep their jobs and A/D come free.",
    cost:
      "Yaw is still on/off rather than proportional, and you need the buttons — this one does not exist on a plain two-button mouse.",
    binds: [
      { fn: "Collective raise / lower", key: "W / S" },
      { fn: "Pitch — cyclic X", key: "Mouse up / down" },
      { fn: "Roll — cyclic Y", key: "Mouse left / right" },
      { fn: "Yaw left / right", key: "Mouse thumb buttons" },
      { fn: "Free look", key: "Right mouse" },
    ],
  },

  /* ----------------------------------------------------- keyboard only */
  {
    id: "wasd-arrows",
    name: "WASD + arrows",
    family: "Keyboard only",
    mouse: "Not used",
    suits:
      "Splitting the aircraft across both hands: left hand on power and tail, right hand flying the cyclic on the arrow keys. The mouse is left alone entirely, so it is free to aim and the view never fights the aircraft.",
    cost:
      "Both hands leave the rest of the keyboard, so anything else you need — flares, crates, seats — has to be reachable from one of them.",
    binds: [
      { fn: "Collective raise / lower", key: "W / S" },
      { fn: "Pitch — cyclic X", key: "↑ / ↓" },
      { fn: "Roll — cyclic Y", key: "← / →" },
      { fn: "Yaw left / right", key: "A / D" },
      { fn: "Free look", key: "L Alt" },
    ],
  },
  {
    id: "arrows-fly",
    name: "Arrows fly · WASD supports",
    family: "Keyboard only",
    mouse: "Not used",
    suits:
      "The same idea the other way round: the cyclic on the arrows, collective and yaw grouped together under the left hand on W/S and Q/E.",
    cost:
      "A and D end up unused for flight, which feels wrong to most people until it does not.",
    binds: [
      { fn: "Collective raise / lower", key: "W / S" },
      { fn: "Pitch — cyclic X", key: "↑ / ↓" },
      { fn: "Roll — cyclic Y", key: "← / →" },
      { fn: "Yaw left / right", key: "Q / E" },
      { fn: "Free look", key: "L Alt" },
    ],
  },
  {
    id: "all-wasd",
    name: "All left hand",
    family: "Keyboard only",
    mouse: "Not used",
    suits:
      "Everything under one hand: cyclic on WASD, yaw on Q and E, collective on space and shift. The right hand never touches the aircraft.",
    cost:
      "Four fingers doing four jobs at once. It is the most cramped of these, and the hardest to hold a hover with.",
    binds: [
      { fn: "Collective raise / lower", key: "Space / L Shift" },
      { fn: "Pitch — cyclic X", key: "W / S" },
      { fn: "Roll — cyclic Y", key: "A / D" },
      { fn: "Yaw left / right", key: "Q / E" },
      { fn: "Free look", key: "L Alt" },
    ],
  },
  {
    id: "keyboard-real-pilot",
    name: "Real-pilot keyboard",
    family: "Keyboard only",
    mouse: "Not used",
    suits:
      "The cockpit, as closely as a keyboard allows: collective under the left hand on shift and control, cyclic under the right on WASD, tail rotor on Q and E.",
    cost:
      "Nothing is analogue, so every input is full deflection. Small corrections have to be made by tapping.",
    binds: [
      { fn: "Collective raise / lower", key: "L Shift / L Ctrl" },
      { fn: "Pitch — cyclic X", key: "W / S" },
      { fn: "Roll — cyclic Y", key: "A / D" },
      { fn: "Yaw left / right", key: "Q / E" },
      { fn: "Free look", key: "Right mouse" },
    ],
  },

  /* --------------------------------------------------------- hardware */
  {
    id: "hotas",
    name: "HOTAS — stick and throttle",
    family: "Hardware",
    mouse: "Not used",
    suits:
      "The real arrangement. Collective on the throttle lever, cyclic on the stick, yaw on the twist or on pedals — all four axes proportional at once, which is the thing no keyboard can give you.",
    cost:
      "Setup work, and the game's sensitivity curves need attention before it feels right. Aiming a rifle from the seat becomes awkward.",
    binds: [
      { fn: "Collective raise / lower", key: "Throttle axis" },
      { fn: "Pitch — cyclic X", key: "Stick fore / aft" },
      { fn: "Roll — cyclic Y", key: "Stick left / right" },
      { fn: "Yaw left / right", key: "Stick twist or pedals" },
      { fn: "Free look", key: "Hat switch" },
    ],
  },
  {
    id: "controller",
    name: "Controller",
    family: "Hardware",
    mouse: "Not used",
    suits:
      "Two analogue sticks, which is three of the four axes solved out of the box. The most forgiving way to learn a hover.",
    cost:
      "Collective on the triggers is coarse, and everything you do outside the aircraft is worse than it would be on a mouse.",
    binds: [
      { fn: "Collective raise / lower", key: "Left stick up / down" },
      { fn: "Pitch — cyclic X", key: "Right stick up / down" },
      { fn: "Roll — cyclic Y", key: "Right stick left / right" },
      { fn: "Yaw left / right", key: "Left stick left / right" },
      { fn: "Free look", key: "Hold left bumper" },
    ],
  },
];

/*
  The rest of the aircraft. These do not vary between layouts the way the four
  axes do, and every one of them was read off the keybindings screen in
  VGAIN's video at 2:04 — including the two the game ships unbound, which is
  worth knowing before your first logistics run.
*/
export const generalBinds: Bind[] = [
  { fn: "Lock / unlock vehicle", key: "L" },
  { fn: "Activate counter measure", key: "V" },
  { fn: "Buy ammo / supplies", key: "B" },
  { fn: "Deploy supply crate", key: "G" },
  { fn: "Horn", key: "H" },
  { fn: "Fire weapon", key: "Left mouse" },
  { fn: "Cycle weapons", key: "Z" },
  { fn: "Cycle fire mode", key: "B" },
  { fn: "Eject from projectile", key: "C" },
  { fn: "Next / previous seat", key: "0 / 9" },
];

export const layoutCount = layouts.length;
export const seenCount = layouts.filter((l) => l.seen).length;
export const byFamily = (f: Family) => layouts.filter((l) => l.family === f);
