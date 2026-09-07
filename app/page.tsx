import Link from "next/link";
import Logo from "@/components/Logo";
import Icon, { type IconName } from "@/components/Icon";
import { maneuvers } from "@/data/maneuvers";
import { guides } from "@/data/guides";
import { creatorCount, creatorVideoCount } from "@/data/creators";

/*
  The front door. Four destinations in a 2x2 grid — the simulator, the written
  guides, the creators they came from, and the desktop app.

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
      "Every maneuver flown in 3D with the pilot's collective, cyclic and pedals moving live beside it. Scrub it, slow it down, watch what the hands are doing at the moment the nose comes up.",
    stat: `${maneuvers.length} maneuvers`,
  },
  {
    href: "/guides/",
    icon: "book",
    title: "Videos & Guides",
    kicker: "Read it",
    body:
      "Community videos written up in full — settings, numbers and technique, with the original always one click away and the author credited at the top of the page, not in a footnote.",
    stat: `${guides.length} guides`,
  },
  {
    href: "/youtubers/",
    icon: "users",
    title: "Youtubers",
    kicker: "Watch them",
    body:
      "The people this site is built on. Every channel we have learned from, what each one is good for, and every video we went through — linked straight to them.",
    stat: `${creatorCount} creators · ${creatorVideoCount} videos`,
  },
  {
    href: "/pilot-app/",
    icon: "monitor",
    title: "Pilot App",
    kicker: "Fly with it",
    body:
      "A desktop companion for the second screen — the reference and the pilot's tools next to the game instead of behind it.",
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
            Everything for flying helicopters in WARDOGS. Built out of the
            community&rsquo;s own videos, with the people who made them credited
            on every page.
          </p>
        </header>

        <nav aria-label="Sections">
          <ul className="home-grid">
            {doors.map((d, i) => (
              <li key={d.href}>
                <Link
                  className={`home-card${d.soon ? " is-soon" : ""}`}
                  href={d.href}
                >
                  <span className="home-card-top">
                    <span className="home-card-icon">
                      <Icon name={d.icon} size={22} />
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
          <p>
            Also here: the{" "}
            <Link href="/terminology/">terminology page</Link> — collective,
            cyclic, crab, flare, AGL and the rest, with the trap in each.
          </p>
          <p>Unofficial. Not affiliated with the developer of WARDOGS.</p>
        </footer>
      </div>
    </div>
  );
}
