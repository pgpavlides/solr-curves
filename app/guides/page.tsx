import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import YouTubeThumb from "@/components/YouTubeThumb";
import { guides, videoUrl } from "@/data/guides";

export const metadata: Metadata = {
  title: "Guides — wardogspilot",
  description:
    "WARDOGS helicopter guides written up from the community's own videos, with every author credited and linked.",
};

export default function GuidesIndex() {
  const creators = new Set(guides.map((g) => g.source.channel));

  return (
    <DocShell wide crumb={{ href: "/", label: "Home" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Guides</span>
        <h1>Learn from the people flying it.</h1>
        <p className="doc-lede">
          Written up from community videos, with the original always one click
          away. If a guide helps you, the person who earned that is on the other
          end of the link — go and watch it, and subscribe to them.
        </p>
        <p className="doc-count">
          {guides.length} guides · {creators.size} creators
        </p>
      </header>

      <ul className="guide-grid">
        {guides.map((g, i) => (
          <li key={g.slug} className="guide-item">
            <Link className="guide-card" href={`/guides/${g.slug}/`}>
              <YouTubeThumb
                videoId={g.source.videoId}
                alt={`Thumbnail for ${g.source.title} by ${g.source.channel}`}
                duration={g.source.duration}
                eager={i < 2}
              />
              <span className="guide-body">
                <span className="guide-kicker">{g.kicker}</span>
                <span className="guide-title">{g.title}</span>
                <span className="guide-sum">{g.summary}</span>
                <span className="card-meta">
                  {g.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </span>
              </span>
            </Link>

            {/* Credit sits outside the card link so the channel and the video
                are their own links, not swallowed by the guide link. */}
            <p className="guide-credit">
              <a href={g.source.channelUrl} rel="noopener" target="_blank">
                {g.source.channel}
              </a>
              <span className="sep">·</span>
              <a href={videoUrl(g.source.videoId)} rel="noopener" target="_blank">
                {g.source.title}
              </a>
              <span className="sep">·</span>
              <span className="guide-date">{g.source.published}</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="guide-notes">
        <aside className="callout is-critical">
          <span className="callout-label">Not sure what a word means?</span>
          <p>
            The <Link href="/terminology/">terminology page</Link> covers the four
            controls in full, then every term these guides use — collective,
            cyclic, crab, flare, AGL and the rest, with the traps in each.
          </p>
        </aside>

        <aside className="callout">
          <span className="callout-label">Everyone we learned from</span>
          <p>
            These write-ups are a fraction of what is out there. The{" "}
            <Link href="/youtubers/">Youtubers page</Link> lists every channel
            behind this site and every video we went through, linked straight to
            them. If you make WARDOGS flying content and would rather not be
            written up here, say so and the page comes down.
          </p>
        </aside>
      </div>
    </DocShell>
  );
}
