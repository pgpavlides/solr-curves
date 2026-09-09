import type { Metadata } from "next";
import DocShell from "@/components/DocShell";
import { ogCard } from "@/lib/og";
import {
  schemes,
  schemeCount,
  readCount,
  EVIDENCE_NOTE,
} from "@/data/keybindings";

export const metadata: Metadata = {
  title: "Keybinding — wardogspilot",
  description:
    "How the WARDOGS helicopter community actually binds its controls: one scheme per creator, read off their own settings screens, with the timestamp so you can check it.",
  openGraph: ogCard("guides", "WARDOGS helicopter keybindings, per creator"),
  twitter: ogCard("guides", "WARDOGS helicopter keybindings, per creator"),
};

const markUrl = (id: string, at: number) =>
  `https://www.youtube.com/watch?v=${id}&t=${at}s`;

/*
  One scheme per creator.

  The evidence chip on each card is the point of the page, not decoration.
  "Read off the settings screen" and "he said so once" are different kinds of
  claim, and a reader about to rebind their aircraft is entitled to know which
  one they are looking at.
*/
export default function Keybinding() {
  return (
    <DocShell wide crumb={{ href: "/", label: "Home" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Keybinding</span>
        <h1>Everybody binds it differently.</h1>
        <p className="doc-lede">
          There is no correct layout, but there is one decision that splits the
          whole community: what horizontal mouse movement does. Put{" "}
          <strong>roll</strong> on it and the aircraft banks like every other
          shooter you have played. Put <strong>yaw</strong> on it and you aim
          the nose like a rifle, which is better for guns and harder to learn.
          Everything else follows from that.
        </p>
        <p className="doc-count">
          {schemeCount} schemes · {readCount} read off a creator&rsquo;s own
          settings screen
        </p>
      </header>

      <ul className="kb-grid">
        {schemes.map((s) => (
          <li key={s.id} className="kb-item">
            <div className="kb-head">
              <div className="kb-who">
                <span className="kb-tag">{s.tag}</span>
                <h2>
                  {s.channelUrl ? (
                    <a href={s.channelUrl} rel="noopener" target="_blank">
                      {s.creator}
                    </a>
                  ) : (
                    s.creator
                  )}
                </h2>
              </div>
              {s.mouse && (
                <span className={`kb-mouse is-${s.mouse.toLowerCase()}`}>
                  Mouse L/R
                  <b>{s.mouse}</b>
                </span>
              )}
            </div>

            <p className="kb-sum">{s.summary}</p>

            {s.binds && (
              <table className="kb-table">
                <caption>Keys</caption>
                <tbody>
                  {s.binds.map((b) => (
                    <tr key={b.fn}>
                      <th scope="row">{b.fn}</th>
                      <td>
                        <kbd>{b.key}</kbd>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {s.settings && (
              <table className="kb-table">
                <caption>Settings</caption>
                <tbody>
                  {s.settings.map((r) => (
                    <tr key={r.name}>
                      <th scope="row">{r.name}</th>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {s.caveat && <p className="kb-caveat">{s.caveat}</p>}

            <p className="kb-evidence">
              <span className="chip">{EVIDENCE_NOTE[s.evidence]}</span>
              {s.video && (
                <a
                  className="kb-src"
                  href={markUrl(s.video.id, s.video.at)}
                  rel="noopener"
                  target="_blank"
                >
                  {s.video.title} · {s.video.clock}
                </a>
              )}
            </p>
          </li>
        ))}
      </ul>

      <aside className="callout spaced">
        <span className="callout-label">Adding to this</span>
        <p>
          A scheme only goes up when it can be sourced: the creator&rsquo;s own
          settings screen on camera, or them saying it out loud. Nothing here is
          reconstructed from what a layout &ldquo;probably&rdquo; is. If a
          channel you follow has published theirs, point at the video and the
          timestamp and it can be read off and added.
        </p>
      </aside>
    </DocShell>
  );
}
