import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import YouTubeThumb from "@/components/YouTubeThumb";
import { ogCard } from "@/lib/og";
import { guides, videoUrl } from "@/data/guides";

export const metadata: Metadata = {
  title: "Books — wardogspilot",
  description:
    "The written material: settings, numbers and technique from the community, written up in full with the author credited and the original one click away.",
  openGraph: ogCard("guides", "The wardogspilot written guides"),
  twitter: ogCard("guides", "The wardogspilot written guides"),
};

/*
  The reading section.

  These write-ups existed but had nowhere to be found: the old /guides/ index
  was deleted when the videos page absorbed it, which left four finished
  articles reachable only from a single link buried in the terminology page.
  This is their index.

  Cards are the same markup as /videos/ on purpose — one set of classes for
  every gallery on the site, so the two cannot drift apart.

  Every entry credits its source in the card itself, not just inside the
  article. A write-up here is someone else's work in our words, and the link
  out to the original is part of the entry rather than a footnote to it.
*/
export default function Books() {
  const channels = new Set(guides.map((g) => g.source.channel));

  return (
    <DocShell wide crumb={{ href: "/", label: "Home" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Books</span>
        <h1>The things worth reading twice.</h1>
        <p className="doc-lede">
          A video is the right way to be shown something and the wrong way to
          check a number you half-remember. These are the write-ups: the
          settings, the figures and the technique in text you can scan, each one
          from a creator&rsquo;s work, credited, with the original a click away.
        </p>
        <p className="doc-count">
          {guides.length} write-ups · from {channels.size}{" "}
          {channels.size === 1 ? "creator" : "creators"}
        </p>
      </header>

      <ul className="guide-grid">
        {guides.map((g, i) => (
          <li key={g.slug} className="guide-item">
            <Link className="guide-card" href={`/guides/${g.slug}/`}>
              <YouTubeThumb
                videoId={g.source.videoId}
                alt={`Thumbnail from ${g.source.title} by ${g.source.channel}`}
                duration={g.source.duration}
                eager={i < 3}
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

            {/* Outside the card link, so the creator's own link is its own. */}
            <p className="guide-credit">
              <span className="guide-date">From</span>{" "}
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
    </DocShell>
  );
}
