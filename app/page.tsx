import Link from "next/link";
import Logo from "@/components/Logo";
import Icon, { type IconName } from "@/components/Icon";
import { maneuvers } from "@/data/maneuvers";
import { termCount } from "@/data/glossary";
import { creatorCount, creatorVideoCount } from "@/data/creators";

/*
  The front door. Four destinations in a 2x2 grid — the simulator, the videos
  the site is built from, the vocabulary, and the desktop app.

  It is one screen and it does not scroll, and the mark is the subject of it,
  so the cards are capped rather than stretching to fill what is left. That
  makes the copy budget tighter than it looks: a card body is two short lines,
  and a third gets clipped rather than pushing the page taller.

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

const doors: Door[] = [
  {
    href: "/simulator/",
    icon: "helicopter",
    title: "Simulation",
    kicker: "Fly it",
    body:
      "Every maneuver flown in 3D, with the collective, cyclic and pedals moving live beside it.",
    stat: `${maneuvers.length} maneuvers`,
  },
  {
    href: "/videos/",
    icon: "play",
    title: "Videos",
    kicker: "Watch them",
    body:
      "Every video the site was built from, grouped by the creator who made it, and linked back to them.",
    stat: `${creatorVideoCount} videos · ${creatorCount} creators`,
  },
  {
    href: "/terminology/",
    icon: "book",
    title: "Terminology",
    kicker: "Learn it",
    body:
      "Collective, cyclic, crab, flare, AGL — what each word means and the trap in it. Searchable.",
    stat: `${termCount} terms`,
  },
  {
    href: "/pilot-app/",
    icon: "monitor",
    title: "Pilot App",
    kicker: "Fly with it",
    body:
      "A desktop companion for the second screen — the reference beside the game, not behind it.",
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
          <p>Unofficial. Not affiliated with the developer of WARDOGS.</p>
        </footer>
      </div>
    </div>
  );
}
