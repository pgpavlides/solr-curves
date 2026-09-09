import type { Metadata } from "next";
import DocShell from "@/components/DocShell";
import { ogCard } from "@/lib/og";
import {
  FAMILIES,
  byFamily,
  generalBinds,
  layoutCount,
  seenCount,
} from "@/data/keybindings";

export const metadata: Metadata = {
  title: "Keybinding — wardogspilot",
  description:
    "Every sane way to bind a WARDOGS helicopter: mouse-roll, mouse-yaw, WASD and arrows, all-keyboard, HOTAS and controller — the full key table for each one, side by side.",
  openGraph: ogCard("guides", "WARDOGS helicopter keybinding layouts"),
  twitter: ogCard("guides", "WARDOGS helicopter keybinding layouts"),
};

const markUrl = (id: string, at: number) =>
  `https://www.youtube.com/watch?v=${id}&t=${at}s`;

/*
  A catalogue, not a ranking.

  Every layout prints the same five rows in the same order so two of them can
  be read against each other without hunting for the matching line. Where a
  layout has actually been seen in someone's video it says so at the foot of
  the card — that is evidence the thing is in real use, not the reason it is
  on the page.
*/
export default function Keybinding() {
  return (
    <DocShell wide crumb={{ href: "/", label: "Home" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Keybinding</span>
        <h1>Four axes, and nowhere obvious to put them.</h1>
        <p className="doc-lede">
          Collective, pitch, roll and yaw all have to go somewhere, and there
          are only so many places. These are the arrangements people actually
          fly. Pitch is on the mouse&rsquo;s vertical axis in every layout that
          uses the mouse at all — nobody argues about that one — so the whole
          question comes down to what <strong>horizontal</strong> does:{" "}
          <strong>roll</strong> banks the aircraft like every other shooter,{" "}
          <strong>yaw</strong> aims the nose like a rifle. Or you take the mouse
          out of it entirely and fly on keys.
        </p>
        <p className="doc-count">
          {layoutCount} layouts · {seenCount} caught on camera
        </p>
      </header>

      {FAMILIES.map((fam) => (
        <section className="doc-section" key={fam.name} id={fam.name.toLowerCase().replace(/\s+/g, "-")}>
          <h2>{fam.name}</h2>
          <p className="doc-p">{fam.blurb}</p>

          <ul className="kb-grid">
            {byFamily(fam.name).map((l) => (
              <li key={l.id} className="kb-item">
                <div className="kb-head">
                  <div className="kb-who">
                    <h2>{l.name}</h2>
                  </div>
                  <span className={`kb-mouse is-${l.mouse.toLowerCase().replace(/\s+/g, "-")}`}>
                    Mouse L/R
                    <b>{l.mouse}</b>
                  </span>
                </div>

                <table className="kb-table">
                  <tbody>
                    {l.binds.map((b) => (
                      <tr key={b.fn}>
                        <th scope="row">{b.fn}</th>
                        <td>
                          <kbd>{b.key}</kbd>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="kb-sum">
                  <b>Suits</b> {l.suits}
                </p>
                <p className="kb-caveat">
                  <b>Costs you</b> {l.cost}
                </p>

                {l.seen && (
                  <p className="kb-evidence">
                    <span className="chip">
                      {l.seen.fromMenu ? "Seen on their settings screen" : "Said on camera"}
                    </span>
                    <a
                      className="kb-src"
                      href={markUrl(l.seen.videoId, l.seen.at)}
                      rel="noopener"
                      target="_blank"
                    >
                      {l.seen.who} · {l.seen.clock}
                    </a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="doc-section" id="everything-else">
        <h2>Everything that is not an axis</h2>
        <p className="doc-p">
          These do not change between layouts. Two of them ship{" "}
          <strong>unbound</strong>, and one of those two is how you do logistics
          at all — worth fixing before your first run rather than while a squad
          waits on the crate.
        </p>
        <ul className="kb-grid">
          <li className="kb-item">
            <table className="kb-table">
              <tbody>
                {generalBinds.map((b) => (
                  <tr key={b.fn}>
                    <th scope="row">{b.fn}</th>
                    <td>
                      <kbd>{b.key}</kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="kb-evidence">
              <span className="chip">Seen on their settings screen</span>
              <a
                className="kb-src"
                href={markUrl("Wg9ve3wWJ_E", 124)}
                rel="noopener"
                target="_blank"
              >
                VGAIN · 2:04
              </a>
            </p>
          </li>
        </ul>
      </section>
    </DocShell>
  );
}
