/*
  Who binds what, and how we know.

  The one thing this page must never do is invent a keybind. A wrong key here
  is worse than no page at all: somebody rebinds their aircraft to it and finds
  out in the air. So every scheme carries `evidence`, and the page prints what
  each level means:

    menu-on-screen   the creator opened the game's own settings or keybindings
                     screen on camera, and the values were read off the frame
                     at the timestamp recorded here
    stated-on-video  they said it, or it is in their own burned-in captions,
                     but the menu itself was never shown
    site-tables      no single creator — the composite layouts this site has
                     carried from the start, from reading across many videos

  A row that cannot be sourced to one of those three does not go in. Where a
  creator was visibly mid-edit — the second video below is literally about
  fixing broken binds — the rows that were changing are left out and said so,
  rather than frozen into a table as if they were settled.

  Timestamps are seconds, so every link opens on the frame the numbers came
  from and anybody can check the work.
*/

export interface Bind {
  fn: string;
  key: string;
}

export interface Setting {
  name: string;
  value: string;
}

export type Evidence = "menu-on-screen" | "stated-on-video" | "site-tables";

export interface Scheme {
  id: string;
  /** channel name exactly as they publish it, or the layout's name */
  creator: string;
  channelUrl?: string;
  video?: { id: string; title: string; at: number; clock: string };
  /** what a horizontal mouse movement does — the choice that defines a scheme */
  mouse?: "Roll" | "Yaw";
  tag: string;
  summary: string;
  settings?: Setting[];
  binds?: Bind[];
  /** what is deliberately not listed, and why */
  caveat?: string;
  evidence: Evidence;
}

export const EVIDENCE_NOTE: Record<Evidence, string> = {
  "menu-on-screen": "Read off the game's own settings screen in their video",
  "stated-on-video": "Said on camera; the menu itself was never shown",
  "site-tables": "Composite layout, read across many videos",
};

export const schemes: Scheme[] = [
  {
    id: "vgain",
    creator: "VGAIN",
    channelUrl: "https://www.youtube.com/results?search_query=VGAIN+wardogs",
    video: {
      id: "Wg9ve3wWJ_E",
      title:
        "WarDogs Helicopter Tutorial – How to Fly with Mouse & Keyboard + FIX Keybindings!",
      at: 60,
      clock: "1:00",
    },
    mouse: "Yaw",
    tag: "Mouse aims the nose",
    summary:
      "The only creator here who puts the whole settings screen on camera and holds it there. Horizontal mouse is yaw, so the nose is aimed like a rifle and roll lives on the keyboard — the harder half of the split, and the one that shoots better.",
    settings: [
      { name: "Vehicle weapon sensitivity", value: "1.00" },
      { name: "Ground vehicle multiplier", value: "0.50" },
      { name: "Air vehicle multiplier", value: "0.50" },
      { name: "Rotary vehicle mouse control", value: "Enabled" },
      { name: "Helicopter mouse swipe left/right", value: "Yaw" },
      { name: "Helicopter mouse swipe up/down", value: "Pitch" },
      { name: "Helicopter mouse pitch sensitivity", value: "50%" },
      { name: "Helicopter mouse yaw sensitivity", value: "50%" },
      { name: "Helicopter mouse axis isolation", value: "0%" },
      { name: "Invert Y axis — ground vehicle", value: "Disabled" },
      { name: "Invert Y axis — air vehicle", value: "Disabled" },
      { name: "Missile mouse control", value: "Enabled" },
      { name: "Invert Y axis — missile", value: "Enabled" },
    ],
    binds: [
      { fn: "Collective (raise)", key: "W" },
      { fn: "Collective (lower)", key: "S" },
      { fn: "Yaw left", key: "A" },
      { fn: "Yaw right", key: "D" },
      { fn: "Lock / unlock vehicle", key: "L" },
      { fn: "Activate counter measure", key: "V" },
      { fn: "Buy ammo / supplies", key: "B" },
      { fn: "Deploy supply crate", key: "G" },
      { fn: "Horn", key: "H" },
      { fn: "Fire weapon", key: "Left mouse" },
      { fn: "Cycle weapons", key: "Z" },
      { fn: "Cycle fire mode", key: "B" },
      { fn: "Eject from projectile", key: "C" },
      { fn: "Vehicle weapon pitch up / down", key: "W / S" },
      { fn: "Vehicle weapon yaw left", key: "A" },
    ],
    caveat:
      "The cyclic X and Y rows are left out on purpose. He is rebinding them while the camera is on the menu — that is what the video is for — so what is on screen at any one second is a step in the edit, not where he left it.",
    evidence: "menu-on-screen",
  },
  {
    id: "yourchopperpilot",
    creator: "Your Chopper Pilot",
    channelUrl: "https://www.youtube.com/@YourChopperPilot",
    video: {
      id: "RvDm0GMj0x0",
      title: "War Dogs Helicopter Mouse and Keyboard Keybind Tutorial",
      at: 140,
      clock: "2:20",
    },
    mouse: "Roll",
    tag: "Mouse banks the aircraft",
    summary:
      "The other half of the split, and he says so in as many words: “I personally prefer left and right on the mouse to be roll.” Banking turns come out smooth and Battlefield-familiar; yaw moves to the keyboard, and gun work gets coarser for it.",
    caveat:
      "He never opens the keybindings screen on camera, so there is no table to read. What is above is his own stated preference, not a menu.",
    evidence: "stated-on-video",
  },
  {
    id: "layout-battlefield",
    creator: "Layout A — Battlefield",
    tag: "Most common",
    summary:
      "Where most people land coming from another shooter: collective on W and S where the throttle used to be, and the mouse doing most of the flying.",
    binds: [
      { fn: "Collective raise", key: "W" },
      { fn: "Collective lower", key: "S" },
      { fn: "Cyclic X — pitch", key: "Mouse up / down" },
      { fn: "Cyclic Y — roll", key: "A / D" },
      { fn: "Yaw left / right", key: "Mouse L/R + keys" },
      { fn: "Free look", key: "L Alt" },
    ],
    evidence: "site-tables",
  },
  {
    id: "layout-real-pilot",
    creator: "Layout B — Real-pilot",
    tag: "3,000 rotary hours",
    summary:
      "Laid out the way the aircraft actually is: collective under the left hand on shift and control, cyclic on WASD under the right, and the tail rotor on the thumb — the closest a keyboard gets to the real thing.",
    binds: [
      { fn: "Collective raise", key: "L Shift" },
      { fn: "Collective lower", key: "L Ctrl" },
      { fn: "Cyclic X — pitch", key: "W / S" },
      { fn: "Cyclic Y — roll", key: "A / D" },
      { fn: "Yaw left / right", key: "Mouse thumb buttons" },
      { fn: "Free look", key: "Right mouse" },
    ],
    evidence: "site-tables",
  },
  {
    id: "layout-all-keys",
    creator: "Layout C — All-keys",
    tag: "No mouse flight",
    summary:
      "Nothing on the mouse at all. Every axis is a key, which costs you fine control and gives back a machine that behaves identically every time — and a mouse left free to aim.",
    binds: [
      { fn: "Collective raise", key: "Space" },
      { fn: "Collective lower", key: "L Shift" },
      { fn: "Cyclic X — pitch", key: "W / S" },
      { fn: "Cyclic Y — roll", key: "A / D" },
      { fn: "Yaw left / right", key: "Q / E" },
      { fn: "Free look", key: "L Alt" },
    ],
    evidence: "site-tables",
  },
];

export const schemeCount = schemes.length;
export const readCount = schemes.filter((s) => s.evidence !== "site-tables").length;
