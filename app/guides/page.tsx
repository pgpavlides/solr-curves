import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import { guides, videoUrl } from "@/data/guides";

export const metadata: Metadata = {
  title: "Guides — wardogspilot",
  description:
    "WARDOGS helicopter guides written up from the community's own videos, with every author credited and linked.",
};

export default function GuidesIndex() {
  return (
    <DocShell>
      <header className="doc-head">
        <span className="doc-eyebrow">Guides</span>
        <h1>Learn from the people flying it.</h1>
        <p className="doc-lede">
          Written up from community videos, one guide per creator, with the
          original always linked. If a guide helps you, the person who earned
          that is on the other end of the link — go and watch it.
        </p>
      </header>

      <ul className="guide-list">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link className="guide-card" href={`/guides/${g.slug}/`}>
              <span className="guide-kicker">{g.kicker}</span>
              <h2>{g.title}</h2>
              <p>{g.summary}</p>
              <span className="guide-meta">
                <span className="guide-by">
                  by <strong>{g.source.channel}</strong>
                </span>
                <span className="guide-len">{g.source.duration}</span>
              </span>
              <span className="card-meta">
                {g.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </span>
            </Link>
            <p className="guide-source-line">
              Source:{" "}
              <a href={videoUrl(g.source.videoId)} rel="noopener" target="_blank">
                {g.source.title}
              </a>{" "}
              &mdash;{" "}
              <a href={g.source.channelUrl} rel="noopener" target="_blank">
                {g.source.channel}
              </a>
              , {g.source.published}
            </p>
          </li>
        ))}
      </ul>

      <aside className="callout is-critical spaced">
        <span className="callout-label">Not sure what a word means?</span>
        <p>
          The <Link href="/terminology/">terminology page</Link> covers the four
          controls in full, then every term these guides use — collective,
          cyclic, crab, flare, AGL and the rest, with the traps in each.
        </p>
      </aside>

      <aside className="callout spaced">
        <span className="callout-label">More coming</span>
        <p>
          This list is being added to. If you make WARDOGS flying content and
          would rather not be written up here, say so and the page comes down.
        </p>
      </aside>
    </DocShell>
  );
}
