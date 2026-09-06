export interface BindRow {
  fn: string;
  /** one cell per layout, in the order of `layouts` */
  keys: string[];
}

export const layouts = [
  { name: "A · Battlefield", note: "most common" },
  { name: "B · Real-pilot", note: "3,000 rotary hours" },
  { name: "C · All-keys", note: "no mouse flight" },
];

export const bindRows: BindRow[] = [
  { fn: "Collective raise", keys: ["W", "L Shift", "Space"] },
  { fn: "Collective lower", keys: ["S", "L Ctrl", "L Shift"] },
  { fn: "Cyclic X — pitch", keys: ["Mouse up/down", "W / S", "W / S"] },
  { fn: "Cyclic Y — roll", keys: ["A / D", "A / D", "A / D"] },
  {
    fn: "Yaw left / right",
    keys: ["Mouse L/R + keys", "Mouse thumb buttons", "Q / E"],
  },
  { fn: "Free look", keys: ["L Alt", "Right mouse", "L Alt"] },
];

export interface HotkeyRow {
  fn: string;
  key: string;
  why: string;
}

export const hotkeys: HotkeyRow[] = [
  {
    fn: "Free look",
    key: "L Alt",
    why: "Look around while the aircraft keeps flying — essential for landing and for spotting an inbound missile",
  },
  {
    fn: "Countermeasures / flares",
    key: "V",
    why: "Put it somewhere you can hit under pressure; a mouse button is common",
  },
  {
    fn: "Toggle camera",
    key: "C",
    why: "Cockpit view is better for very low, very fast flight",
  },
  {
    fn: "Deploy supply crate",
    key: "unbound",
    why: "Unbound by default — you cannot do logistics runs without it",
  },
  {
    fn: "Lock / unlock vehicle",
    key: "L",
    why: "Cycles locked → squad only → everyone. Also reachable via F → scroll to unlock, pressing until it reads &ldquo;unlock for all&rdquo;",
  },
  {
    fn: "Buy menu (vendor)",
    key: "B",
    why: "Flares, crates, parachutes, ammo — usable from the pilot seat at base",
  },
  {
    fn: "Enter vehicle",
    key: "F",
    why: "Enter from the <b>pilot side</b> — the prompt reads PILOT on one side and PASSENGER on the other",
  },
  {
    fn: "Horn",
    key: "unbound",
    why: "Signals infantry that you have landed, or that you are waiting on them",
  },
];
