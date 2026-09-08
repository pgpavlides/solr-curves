import Link from "next/link";
import Logo from "@/components/Logo";
import Icon, { type IconName } from "@/components/Icon";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { maneuvers } from "@/data/maneuvers";
import { termCount } from "@/data/glossary";
import { creatorCount, creatorVideoCount } from "@/data/creators";

/*
  The map counts come from public/markers.json, read here at BUILD time off the
  filesystem. It is 151 KB and is fetched by the map route at runtime, so
  importing it would put all of it in this page's JavaScript for the sake of
  two numbers. This read happens in Node during `next build` and ships nothing.
*/
function mapCounts() {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "public", "markers.json"), "utf8")
  ) as { maps: Record<string, { zones: unknown[] }> };
  const maps = Object.values(raw.maps);
  return { maps: maps.length, zones: maps.reduce((n, m) => n + m.zones.length, 0) };
}

/*
  The front door. The mark, at the size it deserves, and five destinations in
  a single row beneath it — the simulator, the videos the site is built from,
  the game maps, the vocabulary, and the desktop app.

  It is one screen and it does not scroll, and the mark is the subject of it,
  so the cards are capped rather than stretching to fill what is left. That
  makes the copy budget tight: a card in the row of five is about 250px wide,
  so a body is one short sentence of roughly fifty characters and no more.

  Everything the cards say is counted from the data modules rather than typed
  in, so a number on this page cannot drift away from what is behind the link.
*/

interface Door {
  href: string;
  icon: IconName;
  title: string;
  kicker: string;
  body: string;
  stat: string;
  /** not shipped yet — the card says so instead of pretending */
  soon?: boolean;
}

const { maps: mapCount, zones: zoneCount } = mapCounts();

const doors: Door[] = [
  {
    href: "/simulator/",
    icon: "helicopter",
    title: "Simulation",
    kicker: "Fly it",
    body:
      "Every maneuver flown in 3D with the pilot's inputs.",
    stat: `${maneuvers.length} maneuvers`,
  },
  {
    href: "/videos/",
    icon: "play",
    title: "Videos",
    kicker: "Watch them",
    body:
      "Every video the site is built from, and who made it.",
    stat: `${creatorVideoCount} videos · ${creatorCount} creators`,
  },
  {
    href: "/map/ozeti/",
    icon: "map",
    title: "Maps",
    kicker: "Find it",
    body: "Ozeti and Bakurani, with towers and zones as layers.",
    stat: `${mapCount} maps · ${zoneCount} zones`,
  },
  {
    href: "/terminology/",
    icon: "book",
    title: "Terminology",
    kicker: "Learn it",
    body:
      "What each word actually means, and the trap in it.",
    stat: `${termCount} terms`,
  },
  {
    href: "/pilot-app/",
    icon: "monitor",
    title: "Pilot App",
    kicker: "Fly with it",
    body:
      "The reference beside the game instead of behind it.",
    stat: "In development",
    soon: true,
  },
];

export default function Home() {
  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-head">
          <span className="home-mark">
            <Logo />
          </span>
          <h1 className="home-word">wardogspilot</h1>
          <p className="home-lede">
            Everything for flying helicopters in WARDOGS — built out of the
            community&rsquo;s own videos, with the people who made them credited
            on every page.
          </p>
        </header>

        <nav className="home-nav" aria-label="Sections">
          <ul className="home-grid">
            {doors.map((d, i) => (
              <li key={d.href}>
                <Link
                  className={`home-card${d.soon ? " is-soon" : ""}`}
                  href={d.href}
                >
                  <span className="home-card-top">
                    <span className="home-card-icon">
                      <Icon name={d.icon} size={24} />
                    </span>
                    <span className="home-card-no">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="home-card-kicker">{d.kicker}</span>
                  <h2 className="home-card-title">{d.title}</h2>
                  <p className="home-card-body">{d.body}</p>
                  <span className="home-card-foot">
                    <span className="home-card-stat">{d.stat}</span>
                    <span className="home-card-go" aria-hidden="true">
                      <Icon name="arrowRight" size={18} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="home-foot">
          <p className="home-sig">
            Created with much love from{" "}
            <a
              href="https://steamcommunity.com/id/BroccoliGr/"
              rel="noopener"
              target="_blank"
            >
              Broccoli
            </a>{" "}
            {/* decorative: the line already says "with much love" */}
            <span aria-hidden="true">🥦❤️</span>
          </p>
          <p>Unofficial. Not affiliated with the developer of WARDOGS.</p>
        </footer>
      </div>
    </div>
  );
}
