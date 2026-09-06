import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import Callout from "@/components/Callout";
import SectionHead from "@/components/SectionHead";
import Scene from "@/components/three/Scene";
import { transcriptCount, videoCount, eaDate } from "@/data/meta";

const sections: {
  href: string;
  icon: IconName;
  title: string;
  body: string;
  chips: string[];
}[] = [
  {
    href: "/controls/",
    icon: "gauge",
    title: "The four controls",
    body: "Collective, cyclic, yaw and the lift vector — what each word means in the aircraft before it means a key on your keyboard.",
    chips: ["collective", "cyclic X / Y", "3D"],
  },
  {
    href: "/settings/",
    icon: "sliders",
    title: "Settings first",
    body: "The one setting every guide opens with, the roll-vs-yaw split that changes how the aircraft feels, and sensitivity numbers that actually work.",
    chips: ["mouse control", "rifle aim", "HOTAS"],
  },
  {
    href: "/keybinds/",
    icon: "keyboard",
    title: "Three keybind layouts",
    body: "Battlefield-style, real-pilot, and all-keys — side by side, plus the bindings everybody forgets until they need them.",
    chips: ["3 layouts", "8 hotkeys"],
  },
  {
    href: "/flying/",
    icon: "target",
    title: "Flying & the J-hook",
    body: "A nine-drill syllabus for the firing range, the J-hook as a path you can scrub through, and what actually gets you shot down.",
    chips: ["9 drills", "J-hook", "3D"],
  },
  {
    href: "/maneuvers/",
    icon: "play",
    title: "Maneuver simulator",
    body: "Seven maneuvers flown in 3D with the collective, cyclic and pedals moving as the aircraft moves. Hover, quick stop, level turn, J-hook.",
    chips: ["7 maneuvers", "WebGPU", "live inputs"],
  },
  {
    href: "/logistics/",
    icon: "package",
    title: "Logistics",
    body: "What each supply type feeds, pallets versus boxes, the markup trap at match start, and how the pilot economy pays.",
    chips: ["5 supply types", "markup", "payouts"],
  },
  {
    href: "/numbers/",
    icon: "ruler",
    title: "Numbers that kill people",
    body: "Passenger drop heights against a to-scale soldier, crate ceilings, and the AGL readings you check before anyone jumps.",
    chips: ["≤ 5 m", "3D"],
  },
  {
    href: "/fleet/",
    icon: "helicopter",
    title: "The fleet",
    body: "Every airframe with its cost, seat count and what it is actually for — from the $6,250 trainer to the $18,000 Havoc.",
    chips: ["6 airframes"],
  },
  {
    href: "/glossary/",
    icon: "book",
    title: "Glossary",
    body: "Nineteen terms of art, from weathercocking to nap-of-the-earth, in the plainest language they survive.",
    chips: ["19 terms"],
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="hero-eyebrow">
            <span className="dot" />
            Compiled from {transcriptCount} captioned tutorials
          </span>
          <h1>
            Fly the <span className="accent">helicopters</span> like you already
            know how.
          </h1>
          <p>
            Everything the WARDOGS community has worked out about rotary flight,
            in one place: what the controls actually are, which settings are not
            optional, three keybind layouts that work, and the numbers that
            decide whether your passengers live.
          </p>
          <div className="hero-actions">
            <Link className="btn" href="/controls/">
              Start with the controls
              <Icon name="arrowRight" size={16} />
            </Link>
            <Link className="btn btn-ghost" href="/videos/">
              <Icon name="play" size={15} />
              Source videos
            </Link>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="num">{transcriptCount}</span>
              <span className="label">Transcripts read</span>
            </div>
            <div className="stat">
              <span className="num">{videoCount}</span>
              <span className="label">Videos indexed</span>
            </div>
            <div className="stat">
              <span className="num">4</span>
              <span className="label">Flight controls</span>
            </div>
            <div className="stat">
              <span className="num">5 m</span>
              <span className="label">Safe drop AGL</span>
            </div>
          </div>
        </div>

        <Scene name="hero" />
      </section>

      <section className="section">
        <aside className="horizon-panel">
          <div className="panel-grow">
            <span className="panel-eyebrow">
              <span className="status-dot" />
              Before you fly
            </span>
            <p className="panel-title">Go to the Firing Range</p>
            <p className="panel-note">
              Bottom-left of the main menu. Forward from spawn, two sharp lefts
              to the vehicle vendor, then Air. Every airframe is free and fuel
              costs nothing. Nobody wants to lose an $8,000 loadout because a
              stranger crashed on takeoff.
            </p>
          </div>
        </aside>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Contents"
          title="Nine pages, no filler."
          lede="Each page is one part of the job. Read them in order the first time; after that they are a reference you dip into between rounds."
        />

        <div className="grid">
          {sections.map((s) => (
            <Link key={s.href} className="card card-link" href={s.href}>
              <span className="card-icon">
                <Icon name={s.icon} />
              </span>
              <h3 className="card-title">{s.title}</h3>
              <p className="card-body">{s.body}</p>
              <span className="card-meta">
                {s.chips.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Sourcing"
          title="Where this came from, and what to distrust."
        />
        <div className="grid grid-2">
          <Callout label="How it was built" critical>
            <p>
              Captions were pulled from {transcriptCount} community tutorials and
              read in full — roughly 24,000 words — then cross-checked against a
              published vehicle list. Where sources disagree, the disagreement is
              stated on the page rather than smoothed over.
            </p>
          </Callout>
          <Callout label="A warning about the “wiki” sites">
            <p>
              Search for WARDOGS helicopter guides and you will hit a cluster of
              near-identical sites — wardogswiki.com, thewardogs.wiki,
              wardogsguide.wiki, wardogshub.gg — that are generated SEO content,
              contradict each other, and cite named settings that appear in no
              gameplay footage. None of them were used here.
            </p>
          </Callout>
        </div>
      </section>

      <section className="section">
        <aside className="horizon-panel">
          <div className="panel-grow">
            <span className="panel-eyebrow">Status</span>
            <p className="panel-title">Early Access opens {eaDate}</p>
            <p className="panel-note">
              Figures here reflect the two closed betas. Keybind defaults moved
              between them at least once, so check the menu rather than trusting
              any guide — including this one.
            </p>
          </div>
          <Link className="btn btn-secondary" href="/keybinds/">
            Check the binds
          </Link>
        </aside>
      </section>
    </>
  );
}
