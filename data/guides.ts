/*
  Community guides.

  Every guide is someone else's work, written up here in our own words with the
  author credited in the header, in the body where a specific number came from
  them, and in the footer. `source` is required by the type — a guide cannot
  exist in this file without saying whose it is.
*/

export interface Source {
  /** creator's channel name, exactly as they publish it */
  channel: string;
  channelUrl: string;
  title: string;
  videoId: string;
  published: string;
  duration: string;
}

export type Block =
  | { kind: "p"; html: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { title: string; detail: string }[] }
  | { kind: "callout"; label: string; html: string; critical?: boolean }
  | { kind: "table"; caption?: string; head: string[]; rows: string[][] };

export interface Section {
  id: string;
  heading: string;
  blocks: Block[];
}

export interface Guide {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  tags: string[];
  source: Source;
  sections: Section[];
}

export const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const guides: Guide[] = [
  {
    slug: "hotas-setup",
    title: "Setting up a HOTAS for WARDOGS",
    kicker: "Controls",
    summary:
      "Why a flight stick feels wrong in WARDOGS out of the box, and the dead zone, sensitivity and response curve that fix it — plus the landing habits that stop you tipping over on touchdown.",
    tags: ["HOTAS", "sensitivity", "curves", "landings"],
    source: {
      channel: "Sim Controls",
      channelUrl: "https://www.youtube.com/channel/UC_lgWjvPrOiJ_Xw4tQdaAwQ",
      title: "How I Made HOTAS Helicopter Controls Feel Better in WARDOGS",
      videoId: "TciRy5CzvDQ",
      published: "6 September 2026",
      duration: "18:46",
    },
    sections: [
      {
        id: "why",
        heading: "Why the stick feels wrong to begin with",
        blocks: [
          {
            kind: "p",
            html: "The single thing that explains almost every HOTAS complaint in WARDOGS: the flight model treats your stick axes exactly like keyboard keys. It is a direct port of the WASD scheme, not a separate analogue path.",
          },
          {
            kind: "callout",
            label: "The mechanic underneath",
            critical: true,
            html: "Centre stick is the equivalent of <strong>pressing no key at all</strong>. Any deflection is the equivalent of <strong>holding a key down</strong> — and holding a key does not command an attitude, it keeps <em>adding</em> to one. Push the stick 1% forward and the nose does not settle 1% nose-down; it keeps going down for as long as you hold it.",
          },
          {
            kind: "p",
            html: "In most helicopter sims you can hold the stick forward and the aircraft settles into that attitude and stays there. Here it does not. That difference is why sticks feel uncontrollable until they are set up for it, and it is why finding centre reliably matters more than anything else in your configuration.",
          },
        ],
      },
      {
        id: "deadzone",
        heading: "Dead zone: make centre a place you can find",
        blocks: [
          {
            kind: "p",
            html: "Because centre means <em>stop adding input</em>, centre has to be somewhere your hand can actually return to. Sim Controls flies a springless VKB stick and treats a dead zone as essential — without spring pressure there is no physical cue telling you when you are neutral.",
          },
          {
            kind: "list",
            items: [
              "<strong>Springless stick</strong> (VKB and similar): add a deliberate dead zone. It should be wide enough that small hand movements near centre do nothing at all.",
              "<strong>Sprung stick</strong>: you may not need one. The spring already centres you, and the return to centre is something you can feel.",
              "Set it wide enough for confidence at low level, where the corrections are smallest and the consequences of an unintended input are largest.",
            ],
          },
        ],
      },
      {
        id: "sensitivity",
        heading: "Sensitivity: do not go below 1.0",
        blocks: [
          {
            kind: "p",
            html: "Roll, pitch and yaw sensitivity are all set to <strong>1.0</strong>. This is the recommendation that most contradicts instinct — the natural reaction to a twitchy stick is to turn sensitivity down, and that is the wrong lever.",
          },
          {
            kind: "callout",
            label: "What lowering sensitivity actually costs you",
            html: "It does not just calm the middle of the range, it caps the top of it. At a low setting, full deflection no longer produces the aircraft's real roll rate — the helicopter rolls over slowly even with the stick against the stop. You have not made the aircraft gentler, you have made it incapable.",
          },
          {
            kind: "table",
            caption: "Sensitivity, per Sim Controls",
            head: ["Setting", "Effect"],
            rows: [
              ["Below 1.0", "Nerfs you. Full stick no longer reaches the aircraft's real rate of roll."],
              ["<b>1.0</b>", "The tested compromise across landings, J-hooks and combat. Where he settled."],
              ["1.15 – 1.2", "Better still, if you can handle it."],
              ["~1.55 → 2.0", "Possibly no gain at all — he suspects a plateau in this range, and is candid that some of it may be placebo since the game shows no raw input readout."],
            ],
          },
        ],
      },
      {
        id: "curve",
        heading: "The response curve is the real fix",
        blocks: [
          {
            kind: "p",
            html: "Sensitivity alone forces a bad trade: calm near centre <em>or</em> full authority at the stops, not both. A response curve in your stick's own software gives you both, and it is the change that made the difference.",
          },
          {
            kind: "p",
            html: "In VKB's software a linear response is <strong>128 across the whole travel</strong>. Each point on the curve is the sensitivity at that stick position.",
          },
          {
            kind: "steps",
            items: [
              {
                title: "Flatten the centre band to roughly 74–75",
                detail:
                  "Hold it flat across the small-input region so the response there is linear and calm. This is the part of the travel you live in during landings and fine corrections.",
              },
              {
                title: "Ramp up toward the outer travel",
                detail:
                  "Let the curve climb as the stick moves away from centre, so authority builds as you commit to an input.",
              },
              {
                title: "Reach 128 at the stops",
                detail:
                  "128 represents the full capability of the hardware. Hitting it at maximum deflection means you keep the aircraft's entire rate of roll available when you actually need it.",
              },
            ],
          },
          {
            kind: "callout",
            label: "Which axes",
            html: "On his stick, <strong>axes 1 and 2 are X and Y</strong> (roll and pitch) and carry the same curve; <strong>axis 3 is Z</strong>, the yaw twist. He notes the yaw curve is the one still being tuned — holding a target with the minigun while yawing is the hardest thing to do on a stick.",
          },
          {
            kind: "callout",
            label: "No curve software?",
            html: "Then you are stuck with the trade. A stick with no programmable curve means running a lower sensitivity to get usable fine control, and accepting the reduced authority that comes with it. He is direct that this is a real handicap rather than an equivalent option.",
          },
        ],
      },
      {
        id: "assists",
        heading: "Flight assists",
        blocks: [
          {
            kind: "p",
            html: "He flies with <strong>none enabled</strong>, but does not dismiss them for everyone:",
          },
          {
            kind: "list",
            items: [
              "<strong>Hover assist</strong> — not necessary for HOTAS users in his view.",
              "<strong>Stability assist</strong> — genuinely worth trying. It lets you take your hand off the stick occasionally without the aircraft immediately needing corrections.",
            ],
          },
        ],
      },
      {
        id: "landing",
        heading: "Landing: the collective timing",
        blocks: [
          {
            kind: "p",
            html: "Landings are where the whole configuration is proved, and where he spends most of the flying time in the video.",
          },
          {
            kind: "steps",
            items: [
              {
                title: "Collective all the way down on the approach",
                detail: "Hold it down as you descend. This is the default position, not an emergency one.",
              },
              {
                title: "Bring it back toward neutral to kill momentum",
                detail:
                  "A brief move to neutral collective on the way down slows the descent before you are committed.",
              },
              {
                title: "Add a little just before the skids touch",
                detail:
                  "Cushion the arrival. With the collective fully down all the way to the deck you arrive hot.",
              },
            ],
          },
          {
            kind: "callout",
            label: "The overcorrection to avoid",
            html: "Adding <em>too much</em> collective at the bottom is his own recurring mistake, and he says so on camera — the landing goes silly, the aircraft balloons, and you are back where you started. A little is the whole instruction.",
          },
          {
            kind: "p",
            html: "One nuance worth keeping: arriving fast and low off a J-hook, you can sometimes hold the collective fully down all the way in, because you have already traded the speed away. The longer a descent takes, the more vertical speed you accumulate — so a slow, high letdown needs more cushioning than a quick, flat arrival.",
          },
        ],
      },
      {
        id: "tipover",
        heading: "Two ways to stop tipping over",
        blocks: [
          {
            kind: "callout",
            label: "Hold the cyclic into your direction of travel",
            critical: true,
            html: "As the skids touch, keep the stick leaned the way you arrived from — full left lean if you came in from the left. Returning to neutral at the moment of touchdown makes it far more likely that the aircraft tips and digs a skid in on that side.",
          },
          {
            kind: "callout",
            label: "Hold aft cyclic on a fast arrival",
            html: "With speed on and the nose forward, the rotor disc is tilted forward too. Let it stay there as you meet the ground and the aircraft can hook in and front-flip. Holding a little aft keeps the disc back and the airframe out of the dirt.",
          },
        ],
      },
      {
        id: "jhook",
        heading: "Premeditate the landing spot",
        blocks: [
          {
            kind: "p",
            html: "His view on why J-hooks go wrong is not about the stick at all: people start the maneuver without having chosen where they are putting the aircraft down.",
          },
          {
            kind: "list",
            items: [
              "Pick the spot <strong>before</strong> you commit to the maneuver. He demonstrates an unplanned landing on camera and puts it down heavily enough to damage the airframe.",
              "If it is not premeditated, be familiar enough with the area to read your surroundings on the way in — what you can fit into, and what is around you.",
              "Trees, buildings and towers are what you are avoiding while getting low quickly. That awareness is what makes the maneuver safe, not stick skill.",
            ],
          },
          {
            kind: "p",
            html: "The reason to bother at all: the alternative is the slow vertical letdown from height that you see so many pilots do, hanging there in the open the whole way. Bleeding speed on the way in and arriving at an angle gets you on the ground far sooner.",
          },
        ],
      },
      {
        id: "honest",
        heading: "What he is honest about",
        blocks: [
          {
            kind: "list",
            items: [
              "Gunnery on a stick is hard. He describes the minigun as very difficult to be accurate with on a HOTAS, and says he is not good enough at it yet to make a video about it.",
              "He considers the game's HOTAS options limited and would like better support — his settings are working around the options available, not an ideal configuration.",
              "He is still adjusting the curve and may lower the X, Y and yaw axes by a few clicks. These are current settings, not a finished answer.",
            ],
          },
        ],
      },
      {
        id: "disagreement",
        heading: "Where this disagrees with Duskguy — and why both are right",
        blocks: [
          {
            kind: "p",
            html: "Our other HOTAS guide, by <strong>Duskguy</strong>, gives the opposite advice on sensitivity: turn it <em>down</em>, to around 0.75–0.8. Sim Controls says never go below 1.0. Both are correct, and the reason is worth understanding before you pick one.",
          },
          {
            kind: "table",
            head: ["", "Sim Controls", "Duskguy"],
            rows: [
              ["In-game sensitivity", "1.0 or higher", "Lower it, roughly 0.75–0.8"],
              ["Fine control near centre comes from", "A response curve in the stick's own software", "The reduced in-game sensitivity itself"],
              ["Requires", "A stick with programmable curves (VKB and similar)", "Nothing beyond the game's own settings"],
            ],
          },
          {
            kind: "callout",
            label: "They are solving the same problem two ways",
            critical: true,
            html: "Both are after the same thing: calm, precise control around centre. Sim Controls gets it in hardware and keeps game sensitivity high so full deflection still reaches the aircraft's real rate. Duskguy gets it in software, which costs some authority at the stops but needs no special stick. Sim Controls says as much himself — without curve software you will have to run a lower sensitivity. That <em>is</em> Duskguy's setup. <strong>Curve software: follow Sim Controls. No curve software: follow Duskguy.</strong>",
          },
        ],
      },
    ],
  },

  {
    slug: "hotas-quick-start",
    title: "A quick HOTAS, HOSAS or HOCAS start",
    kicker: "Controls",
    summary:
      "The fastest route from an unbound stick to flying: what each control surface actually does in WARDOGS, the settings to change, and the first maneuvers to practise in the firing range.",
    tags: ["HOTAS", "HOSAS", "beginner", "firing range"],
    source: {
      channel: "Duskguy",
      channelUrl: "https://www.youtube.com/channel/UCIZKl6BwGOBCgMdt4NmO2Lw",
      title: "Quick and Easy Wardogs HOTAS Setup",
      videoId: "k01CbrV_Zu8",
      published: "5 September 2026",
      duration: "10:49",
    },
    sections: [
      {
        id: "kit",
        heading: "It is not only for a HOTAS",
        blocks: [
          {
            kind: "p",
            html: "This applies equally to a <strong>HOTAS</strong> (hands on throttle and stick), a <strong>HOCAS</strong> (throttle and collective and stick) and a <strong>HOSAS</strong> (stick and stick). Whatever the arrangement, the game only needs four axes bound and one collective source.",
          },
        ],
      },
      {
        id: "surfaces",
        heading: "What each control actually does here",
        blocks: [
          {
            kind: "callout",
            label: "The collective is not a real collective",
            critical: true,
            html: "In WARDOGS it is a <strong>thrust control</strong>, not a blade-pitch control. Up is more thrust, down is less — and the thrust pulls you in whatever direction the <em>top of the helicopter</em> is pointing. That last part is the whole basis of every maneuver that follows.",
          },
          {
            kind: "list",
            items: [
              "<strong>Pitch</strong> — the nose up and down, like nodding your head.",
              "<strong>Yaw</strong> — rotates the aircraft left and right on the spot.",
              "<strong>Roll</strong> — tilts it left and right. Once tilted, your collective thrust is what pulls you sideways, which is how strafing works.",
            ],
          },
          {
            kind: "p",
            html: "On the HUD, <strong>AGL</strong> is above ground level and <strong>ASL</strong> is above sea level. AGL is the one to fly by; ASL mostly matters near water.",
          },
        ],
      },
      {
        id: "setup",
        heading: "The setup, in order",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Settings → Controls → flight assists → off",
                detail:
                  "If you have gone to the trouble of a stick, turn them off. If you keep one, make it stability assist — and he suggests you can drop even that.",
              },
              {
                title: "Gamepad section → HOTAS → enable",
                detail: "Nothing binds until this is switched on.",
              },
              {
                title: "Bind roll, pitch and yaw axes",
                detail: "Check each one moves the right way before going further.",
              },
              {
                title: "Bind the collective",
                detail:
                  "It can be a throttle, a real collective lever, or the left stick of a dual-stick setup — whichever your hardware gives you.",
              },
              {
                title: "Lower the sensitivity",
                detail:
                  "Counterintuitive, but a stick has far more physical throw than a gamepad. Dropping it to roughly 0.75–0.8 from the default 1.0 lets you use that whole range for small, precise inputs instead of cramming them into the first few millimetres.",
              },
              {
                title: "Set the dead zone to suit the hardware",
                detail:
                  "Default is 0.05. A loose or cheaper stick with play around centre wants more; a tight one wants less. The dead zone is simply where the stick sends nothing at all.",
              },
            ],
          },
          {
            kind: "callout",
            label: "Sensitivity: see the other guide first",
            html: "Sim Controls argues the opposite — 1.0 or higher, with the fine control coming from a curve in the stick's software. Both work; which applies to you depends on whether your stick has programmable curves. The comparison is at the end of the <em>Setting up a HOTAS</em> guide.",
          },
        ],
      },
      {
        id: "range",
        heading: "Getting to a helicopter to practise on",
        blocks: [
          {
            kind: "p",
            html: "In the firing range: walk down the main road, take a <strong>left</strong>, go around the gate, then take <strong>another left</strong> — that is the vehicle vendor. Approach the helicopter <strong>from the right side</strong> to get in as the pilot.",
          },
        ],
      },
      {
        id: "flying",
        heading: "First flying",
        blocks: [
          {
            kind: "list",
            items: [
              "Collective forward for up thrust, then pitch slightly down to start moving forward.",
              "<strong>Pitch up to gain altitude, pitch down to go forward</strong> — and note that going forward costs you height.",
              "Watch the pitch ladder in the centre of the screen, and the level/angle indicator for roll.",
              "<strong>Yaw alone barely works once you are moving quickly.</strong> Combine roll with yaw to make a sharp turn — that combination is the thing to practise.",
              "Plan ahead. The aircraft takes time to respond, so decide what you are doing before you need to be doing it.",
            ],
          },
        ],
      },
      {
        id: "first-maneuvers",
        heading: "Two maneuvers to try once that is comfortable",
        blocks: [
          {
            kind: "callout",
            label: "Barrel roll",
            html: "Easier than it looks, and it only needs altitude. The collective is the whole trick: <strong>up entering the roll, down while inverted, up again as you pull out</strong> — because thrust always follows the top of the aircraft.",
          },
          {
            kind: "callout",
            label: "J-hook",
            html: "Collective down, then pitch, roll and yaw together, watching your AGL the whole way. His own demonstration is not a pretty landing and he says so — but it is not a crash, and the troops get where they were going.",
          },
          {
            kind: "p",
            html: "His framing is worth keeping: this is a basic tutorial for someone learning, not a display by a pilot with thousands of hours. Practise yaw, roll, pitch and general flying first; the advanced maneuvers come after.",
          },
        ],
      },
    ],
  },
];

guides.push({
  slug: "j-hook-technique",
  title: "The J-hook, step by step",
  kicker: "Maneuvers",
  summary:
    "Rolling in, dumping the collective, whipping the tail round with pedal, and the collective discipline that decides whether you arrive or crash. Plus the three mistakes that account for most bad J-hooks.",
  tags: ["J-hook", "landings", "collective", "cross-game"],
  source: {
    channel: "Dynamic",
    channelUrl: "https://www.youtube.com/channel/UCdWBQnQZXlcuVoSBxWfEr7Q",
    title: "How to J Hook in SQUAD",
    videoId: "9B_3rswGrGU",
    published: "24 August 2023",
    duration: "3:22",
  },
  sections: [
    {
      id: "different-game",
      heading: "Read this first: it is a SQUAD tutorial",
      blocks: [
        {
          kind: "callout",
          label: "Different game, same maneuver",
          critical: true,
          html: "This one is <strong>not a WARDOGS video</strong> — it is Dynamic's SQUAD tutorial from 2023. It is here because the J-hook is the same piece of airmanship in both, and because it corroborates our WARDOGS sources independently: collective fully down and held, pedal to whip the tail, nose where you want it, then level and cushion. Dynamic has since made WARDOGS content too. Treat the <em>technique</em> as transferable and the <em>exact numbers and keys</em> as SQUAD's.",
        },
      ],
    },
    {
      id: "standard",
      heading: "The standard J-hook",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              title: "Approach at normal altitude and a sensible speed",
              detail:
                "He flies these between 80 and 120 knots — roughly 150–220 km/h. Fast enough to have energy to trade, not so fast that you cannot manage it.",
            },
            {
              title: "Roll toward the side you are hooking to",
              detail: "He demonstrates hooking right, so he rolls right. Commit to the direction.",
            },
            {
              title: "Collective completely down",
              detail: "All the way, as you commit. This is the same non-negotiable every source repeats.",
            },
            {
              title: "Pull back on the cyclic",
              detail: "Nose up as you roll — the roll and the pull happen together, not one after the other.",
            },
            {
              title: "Hold pedal to whip the tail round",
              detail:
                "Hooking right means holding right pedal. This is what swings the tail out while the nose stays where you are looking.",
            },
            {
              title: "Raise the collective and level out",
              detail:
                "Once the rotation has done its work, collective back in and wings level, using the pedals to settle the direction you are facing.",
            },
          ],
        },
      ],
    },
    {
      id: "collective-on-touchdown",
      heading: "Gauging the collective on the way down",
      blocks: [
        {
          kind: "p",
          html: "His rule for the last part of the descent is refreshingly mechanical: <strong>falling too fast, raise the collective; not falling fast enough, lower it.</strong> Balance altitude against collective and land softly.",
        },
        {
          kind: "callout",
          label: "The number worth stealing",
          html: "If you are worried about dropping too quickly, park the collective around <strong>25%</strong>. You will still lose altitude, but slowly enough to stay in control of the arrival rather than fighting it.",
        },
      ],
    },
    {
      id: "aggressive",
      heading: "The low, fast variant",
      blocks: [
        {
          kind: "p",
          html: "The second version is his go-to when the priority is getting down <em>now</em>. Same approach, but flown lower, turning sharper, with the nose pointed toward the ground. Once the tail has come fully round, level the aircraft and kill the remaining speed as fast as you can.",
        },
        {
          kind: "p",
          html: "It is the same maneuver with less margin. Worth having, worth not attempting first.",
        },
      ],
    },
    {
      id: "mistakes",
      heading: "The three mistakes he sees most",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              title: "Forgetting to level out",
              detail:
                "Watch the attitude indicator in the centre of the screen. Even with backwards momentum, the smallest lean will correct it — and do not chase it with big corrections.",
            },
            {
              title: "Misjudging the collective",
              detail:
                "He is blunt that there is no trick here: soft landings come from practising the collective until you can feel the sink rate. Nothing else fixes it.",
            },
            {
              title: "Not knowing the landing zone",
              detail:
                "Your odds go up enormously if you already know the LZ and what kind of landing it needs. Same conclusion Sim Controls reaches — premeditate the spot.",
            },
          ],
        },
      ],
    },
  ],
});

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug);
