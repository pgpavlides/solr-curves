import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import { maneuvers } from "@/data/maneuvers";
import { guides } from "@/data/guides";
import { creatorCount } from "@/data/creators";

export const metadata: Metadata = {
  title: "Pilot App — wardogspilot",
  description:
    "A desktop companion for WARDOGS pilots — the reference and the pilot's tools on the second screen instead of behind the game. In development.",
};

/*
  Status page for the desktop companion.

  Deliberately written as a plan rather than a feature list: nothing here is
  shipped, and a page that describes unbuilt software in the present tense is
  just a lie with a nicer typeface. When it exists, this page becomes the
  download.
*/
export default function PilotApp() {
  return (
    <DocShell crumb={{ href: "/", label: "Home" }}>
      <article className="doc-article">
        <header className="doc-head">
          <span className="doc-eyebrow">Pilot App</span>
          <h1>The second screen.</h1>
          <p className="doc-lede">
            Everything on this site is useful right up to the moment you are
            actually flying — and then it is behind the game, and alt-tabbing
            out of a hover is how you land on your side. The Pilot App is the
            answer to that: the same material, on the monitor next to you.
          </p>
        </header>

        <aside className="callout is-critical">
          <span className="callout-label">Status</span>
          <p>
            <strong>In development — there is nothing to download yet.</strong>{" "}
            This page is here so the plan is written down in public rather than
            implied by a dead link. It becomes the download page when there is a
            build worth handing out.
          </p>
        </aside>

        <section className="doc-section" id="why">
          <h2>Why an app and not just the website</h2>
          <p className="doc-p">
            A browser tab is fine for reading. It is poor at the job a pilot
            actually has in the air: glance, take one number, look back at the
            game. That wants something that stays put on the second monitor,
            starts where you left it, and does not need a click to get to the
            thing you looked at ninety seconds ago.
          </p>
          <p className="doc-p">
            It also wants to work when the connection does not. Everything the
            site knows &mdash; {maneuvers.length} maneuvers, {guides.length}{" "}
            written guides from {creatorCount} creators, the full terminology
            &mdash; is a fixed body of text and geometry. There is no reason it
            should need the network once it is on your machine.
          </p>
        </section>

        <section className="doc-section" id="shape">
          <h2>The shape it is taking</h2>
          <ul className="doc-list">
            <li>
              <strong>Offline first.</strong> The guides, the terminology and
              the maneuver library ship inside the app. No tab, no loading, no
              connection needed.
            </li>
            <li>
              <strong>Second-screen layout.</strong> Sized and laid out to sit
              beside a game, not to be read full-width. Big enough to glance
              at, small enough to leave open.
            </li>
            <li>
              <strong>The simulator, native.</strong> The same maneuvers, run
              locally instead of streamed as a 1.9&nbsp;MB model over the wire
              every time.
            </li>
            <li>
              <strong>Credit travels with it.</strong> Every guide in the app
              carries the same author credit and the same link out to the
              original video that it has here. That is not negotiable in either
              medium.
            </li>
          </ul>
        </section>

        <section className="doc-section" id="meanwhile">
          <h2>Until then</h2>
          <p className="doc-p">
            The website does all of it, just in a tab. The{" "}
            <Link href="/simulator/">simulator</Link> takes deep links, so{" "}
            <code>/simulator/?m=jhook</code> opens straight onto the J-hook and
            can live in a bookmark or a second window. The{" "}
            <Link href="/videos/">videos</Link> and the{" "}
            <Link href="/terminology/">terminology</Link> are plain pages that
            print and read fine on a phone propped against the monitor.
          </p>
        </section>
      </article>
    </DocShell>
  );
}
