/*
  The people whose work this site is built on.

  Names and channel URLs are the canonical ones YouTube reports for each video
  (oEmbed `author_name` / `author_url`), not names typed from memory — the
  whole point of the page is that the credit is right. Video titles are
  likewise the real ones, so a title here matches the title on YouTube.

  Publish dates and run times come from YouTube's own `uploadDate` and
  `lengthSeconds`, which is how two videos that sat here with an em dash for a
  duration ended up with real ones.

  `guide` points at the write-up in data/guides.ts when a video became one;
  `why` says what stopped one, when there is a specific reason.

  The order is curated, not ranked by volume. The `featured` creator leads
  because he is the reason the site's author started flying.
*/

export interface Mark {
  /** seconds into the video */
  at: number;
  /** end of the moment, in seconds */
  to?: number;
  /** the same, preformatted, so the page never does clock arithmetic */
  clock: string;
  label: string;
}

export interface CreatorVideo {
  id: string;
  /** the title exactly as published */
  title: string;
  length: string;
  /** date published, as YouTube reports it */
  published?: string;
  /** what it is useful for, in our words */
  covers: string;
  /** true when captions were pulled and read for this site */
  transcribed: boolean;
  /** slug in data/guides.ts, when this video became a written guide */
  guide?: string;
  /** why it has not been written up, when there is a specific reason */
  why?: string;
  /** moments worth jumping straight to */
  marks?: Mark[];
}

export interface Creator {
  /** channel name exactly as they publish it */
  name: string;
  channelUrl: string;
  /** short tag for the card */
  tag: string;
  /** why you would go and watch them, in our words */
  note: string;
  /** the one creator this site owes its existence to; leads the page */
  featured?: boolean;
  videos: CreatorVideo[];
}

export const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** the same video, opened at a marked moment */
export const markUrl = (id: string, at: number) =>
  `https://www.youtube.com/watch?v=${id}&t=${at}s`;

export const creators: Creator[] = [
  {
    name: "Arma Pilot",
    channelUrl: "https://www.youtube.com/@ArmaPilot",
    tag: "Where this started",
    note:
      "He is an Arma pilot, and the inspiration to learn to fly.",
    featured: true,
    videos: [
      {
        id: "SiZBHRrblNA",
        title: "The BEST Helicopter Settings in WARDOGS",
        length: "8:56",
        published: "22 August 2026",
        covers: "Settings",
        transcribed: false,
        why:
          "YouTube carries no captions for it, auto-generated or otherwise, so there is nothing to read — only to watch.",
        marks: [
          { at: 218, to: 236, clock: "3:38–3:56", label: "A landing worth copying" },
        ],
      },
    ],
  },
  {
    name: "Cologne TM",
    channelUrl: "https://www.youtube.com/@CologneTM",
    tag: "Real pilot",
    note:
      "A working helicopter pilot with three thousand hours, flying the game and narrating it against what the aircraft actually does. The closest thing here to instruction from a cockpit.",
    videos: [
      {
        id: "bhnqjfTH-Mg",
        title: "REAL PILOT Teaches How To FLY - WARDOGS Helicopter Tutorial (Beginner)",
        length: "4:35",
        published: "2 September 2026",
        covers: "Axes · Drills",
        transcribed: true,
      },
      {
        id: "nD5bxC38pRI",
        title: "REAL PILOT Teaches J-HOOKS - Helicopter Tutorial WARDOGS",
        length: "4:16",
        published: "27 August 2026",
        covers: "J-hook · LZ choice",
        transcribed: true,
        guide: "j-hook-cologne",
      },
    ],
  },
  {
    name: "Sim Controls",
    channelUrl: "https://www.youtube.com/@SimControls",
    tag: "HOTAS",
    note:
      "The deep dive on why a flight stick feels wrong out of the box — dead zone, sensitivity and the response curve that fixes it, worked out on camera.",
    videos: [
      {
        id: "TciRy5CzvDQ",
        title: "How I Made HOTAS Helicopter Controls Feel Better in WARDOGS",
        length: "18:46",
        published: "6 September 2026",
        covers: "HOTAS · Curves · Landings",
        transcribed: true,
        guide: "hotas-setup",
      },
    ],
  },
  {
    name: "Duskguy",
    channelUrl: "https://www.youtube.com/@Duskguy",
    tag: "HOTAS",
    note:
      "The short version of the same job: HOTAS, HOSAS or HOCAS bound and flyable in ten minutes, without the theory.",
    videos: [
      {
        id: "k01CbrV_Zu8",
        title: "Quick and Easy Wardogs HOTAS Setup",
        length: "10:49",
        published: "5 September 2026",
        covers: "HOTAS · Quick start",
        transcribed: true,
        guide: "hotas-quick-start",
      },
    ],
  },
  {
    name: "Dynamic",
    channelUrl: "https://www.youtube.com/@Dynamic_AU",
    tag: "Technique",
    note:
      "The clearest step-by-step J-hook breakdown anywhere — filmed in SQUAD, but the technique transfers whole. Also covers what a pilot actually earns.",
    videos: [
      {
        id: "S6d4pVmC9BI",
        title: "Learning How to Profit as a Wardogs Pilot",
        length: "7:47",
        published: "20 August 2026",
        covers: "Economy",
        transcribed: false,
      },
      {
        id: "9B_3rswGrGU",
        title: "How to J Hook in SQUAD",
        length: "3:22",
        published: "24 August 2023",
        covers: "J-hook · SQUAD",
        transcribed: true,
        guide: "j-hook-technique",
      },
    ],
  },
  {
    name: "StratzFPS",
    channelUrl: "https://www.youtube.com/@StratzFPS",
    tag: "War College",
    note:
      "A structured series rather than one-offs: basic tips first, then orbits, AGL and the things that only matter once you can already hover.",
    videos: [
      {
        id: "wcsY2EeIlyc",
        title: "How to FLY Helis in WARDOGS (5 Basic Tips) | WARDOGS War College",
        length: "7:02",
        published: "12 August 2026",
        covers: "Collective · Money",
        transcribed: true,
      },
      {
        id: "1Vvo7K7moGA",
        title: "ADVANCED Heli Guide for WARDOGS! | WARDOGS War College (Ep. 5)",
        length: "4:58",
        published: "3 September 2026",
        covers: "Orbits · AGL",
        transcribed: true,
      },
    ],
  },
  {
    name: "Nova Gaming",
    channelUrl: "https://www.youtube.com/@NovaGamingX4",
    tag: "Beginner",
    note:
      "The most complete single beginner video — every control, in order, with nothing assumed.",
    videos: [
      {
        id: "3NK8T8hSIn0",
        title: "How to Fly Helicopters in WARDOGS – Complete Beginner Guide",
        length: "10:57",
        published: "2 September 2026",
        covers: "Most complete beginner guide",
        transcribed: true,
      },
    ],
  },
  {
    name: "OnMapleWings",
    channelUrl: "https://www.youtube.com/@OnMapleWings",
    tag: "Theory",
    note:
      "Strong on the lift vector and why banking costs you altitude, then J-hooks and nap-of-the-earth flying from a real pilot's angle.",
    videos: [
      {
        id: "V8Qx9D9vYm4",
        title: "WARDOGS Pilot Guide: How to Fly & Profit (Beginner friendly)",
        length: "10:03",
        published: "24 August 2026",
        covers: "Theory · Landing",
        transcribed: true,
      },
      {
        id: "bu5H5ULa-Ag",
        title: "WARDOGS Pilot Guide: J-Hooks & Double Your Profit From A Real Pilot",
        length: "6:51",
        published: "3 September 2026",
        covers: "Lift vector · NOE",
        transcribed: true,
      },
    ],
  },
  {
    name: "TinyTank800",
    channelUrl: "https://www.youtube.com/@TinyTank800",
    tag: "Logistics",
    note:
      "A full narrated logistics round rather than a tutorial. Watch it for what the job is actually like between the landings.",
    videos: [
      {
        id: "3G2ov9FCNx8",
        title: "What Playing Logistics in WARDOGS Actually Looks Like",
        length: "17:57",
        published: "1 September 2026",
        covers: "Supply chain · Full round, narrated",
        transcribed: true,
      },
    ],
  },
  {
    name: "Jingoea",
    channelUrl: "https://www.youtube.com/@Jingoea",
    tag: "Beginner",
    note:
      "HUD, crates and gunnery for a new pilot trying to make the role pay.",
    videos: [
      {
        id: "_s4gBuvQX0A",
        title: "WARDOGS Helicopter Tutorial | How to Fly for Beginners & Profit",
        length: "9:35",
        published: "27 August 2026",
        covers: "HUD · Crates · Gunnery",
        transcribed: true,
      },
    ],
  },
  {
    name: "KaptainLeeks",
    channelUrl: "https://www.youtube.com/@KaptainLeeks",
    tag: "HOTAS",
    note:
      "A compact HOTAS beginner guide — a useful cross-check against the two longer setup videos.",
    videos: [
      {
        id: "gBiF8kWgLOQ",
        title: "How to Fly Helicopters in WARDOGS with HOTAS | Beginner Guide",
        length: "5:18",
        published: "21 August 2026",
        covers: "HOTAS",
        transcribed: true,
      },
    ],
  },
  {
    name: "Your Chopper Pilot",
    channelUrl: "https://www.youtube.com/@YourChopperPilot",
    tag: "Keybinds",
    note:
      "Mouse-and-keyboard keybinds, laid out key by key.",
    videos: [
      {
        id: "RvDm0GMj0x0",
        title: "War Dogs Helicopter Mouse and Keyboard Keybind Tutorial",
        length: "4:38",
        published: "21 August 2026",
        covers: "Keybinds",
        transcribed: true,
      },
    ],
  },
  {
    name: "SaltyAzz",
    channelUrl: "https://www.youtube.com/@SaltyAzzGaming",
    tag: "Landings",
    note:
      "One thing, done properly: decelerating into a landing without ending up on your side.",
    videos: [
      {
        id: "fH7VUcaarOU",
        title: "Heli Landing Tutorial WARDOGS",
        length: "3:49",
        published: "19 August 2026",
        covers: "Deceleration",
        transcribed: true,
      },
    ],
  },
  {
    name: "LiteralWedgeOfCheese",
    channelUrl: "https://www.youtube.com/@LiteralWedgeOfCheese",
    tag: "Settings",
    note:
      "Flight settings, straight to the numbers.",
    videos: [
      {
        id: "1C0RXAygtOQ",
        title: "WARDOGS - Helicopter Flight Settings",
        length: "3:08",
        published: "21 August 2026",
        covers: "Settings",
        transcribed: true,
      },
    ],
  },
  {
    name: "The Pure Gamer",
    channelUrl: "https://www.youtube.com/@Th3PureGamer",
    tag: "Settings",
    note:
      "A low-sensitivity setup aimed at players who have just started and keep over-controlling.",
    videos: [
      {
        id: "BNyTUNpf3SM",
        title: "WARDOGS – Helicopter Settings for Novice Players",
        length: "4:47",
        published: "22 August 2026",
        covers: "Low-sens setup",
        transcribed: true,
      },
    ],
  },
  {
    name: "Chef Goybeam",
    channelUrl: "https://www.youtube.com/@ChefGoybeam",
    tag: "Controller",
    note:
      "The controller-player answer — the one control scheme the other guides mostly skip.",
    videos: [
      {
        id: "72OTxrlubOo",
        title: "Wardogs flying tutorial for controller players",
        length: "4:22",
        published: "23 August 2026",
        covers: "Controller",
        transcribed: true,
      },
    ],
  },
  {
    name: "VGAiM",
    channelUrl: "https://www.youtube.com/@VGAiM",
    tag: "Keybinds",
    note:
      "Mouse and keyboard, plus the keybinding fixes and the firing range as a practice ground.",
    videos: [
      {
        id: "Wg9ve3wWJ_E",
        title: "🔥 WarDogs Helicopter Tutorial – How to Fly with Mouse & Keyboard + FIX Keybindings! 🚁",
        length: "8:12",
        published: "21 August 2026",
        covers: "Keybinds · Firing range",
        transcribed: true,
      },
    ],
  },
  {
    name: "LewF20",
    channelUrl: "https://www.youtube.com/@LewF20",
    tag: "Getting started",
    note:
      "Getting off the ground for the first time, with rifle aim and logistics alongside.",
    videos: [
      {
        id: "HeVt0xkaEI4",
        title: "How To Get Started With Helicopters In WARDOGS...",
        length: "10:57",
        published: "1 September 2026",
        covers: "Rifle aim · Logistics",
        transcribed: true,
      },
    ],
  },
  {
    name: "Enders",
    channelUrl: "https://www.youtube.com/@EndersFPS",
    tag: "Gameplay",
    note:
      "Close air support, played rather than taught. Worth it for seeing what the airframe can do under fire.",
    videos: [
      {
        id: "rxniPlm7NBo",
        title: "Attack Helicopter Close Air Support in WARDOGS Is INSANE!",
        length: "23:33",
        published: "24 August 2026",
        covers: "Gameplay, not instruction",
        transcribed: true,
      },
    ],
  },
  {
    name: "The Arcade Farmer - SlammDunk Gaming",
    channelUrl: "https://www.youtube.com/@SlammDunkGaming",
    tag: "Failure reel",
    note:
      "The inverse lesson: every way a new pilot puts it into the ground, in two and a half minutes.",
    videos: [
      {
        id: "EkMXZo5Y5-w",
        title: "How not to FLY Helis in WARDOGS (Basic Tips) | WARDOGS War School",
        length: "2:28",
        published: "30 August 2026",
        covers: "Failure reel",
        transcribed: false,
      },
    ],
  },
];

export const creatorCount = creators.length;
export const creatorVideoCount = creators.reduce((n, c) => n + c.videos.length, 0);
