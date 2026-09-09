import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import { ogCard } from "@/lib/og";
import YouTubeThumb from "@/components/YouTubeThumb";
import {
  creators,
  creatorCount,
  creatorVideoCount,
  markUrl,
  videoUrl,
} from "@/data/creators";

export const metadata: Metadata = {
  title: "Videos — broccolipilot",
  description:
    "Every WARDOGS helicopter video this site was built from, grouped by the creator who made it, with what each channel is good for and a link straight back to them.",
  openGraph: ogCard("videos", "The creators broccolipilot is built on"),
  twitter: ogCard("videos", "The creators broccolipilot is built on"),
};

/*
  Every video the site was built from, and the credit for it.

  One card per creator rather than per video, because the subject is the
  person: the card is the channel, and their videos hang underneath it. The
  card classes are shared with the written guides at /guides/<slug>/ so the
  two cannot drift apart.

  Nothing here is a summary of someone's video — it is a pointer to it. Channel
  names, video titles, dates and run times are the canonical ones from YouTube,
  so what is printed here matches what is on their channel.
*/
export default function Videos() {
  const transcribed = creators.reduce(
    (n, c) => n + c.videos.filter((v) => v.transcribed).length,
    0
  );

  return (
    <DocShell wide crumb={{ href: "/", label: "Home" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Videos</span>
        <h1>The people this is built on.</h1>
        <p className="doc-lede">
          None of what is on this site is original flying. It is their work,
          read carefully and written down in one place. Every channel below is
          worth your time directly — go and watch them, and subscribe. The
          order is not a ranking; the first one is where this started.
        </p>
        <p className="doc-count">
          {creatorCount} creators · {creatorVideoCount} videos · {transcribed}{" "}
          gone through in full
        </p>
      </header>

      <ul className="guide-grid">
        {creators.map((c, i) => {
          const lead = c.videos[0];
          return (
            <li
              key={c.name}
              className={`guide-item${c.featured ? " is-featured" : ""}`}
            >
              <a
                className="guide-card"
                href={c.channelUrl}
                rel="noopener"
                target="_blank"
              >
                <YouTubeThumb
                  videoId={lead.id}
                  alt={`Thumbnail from ${lead.title} by ${c.name}`}
                  duration={lead.length}
                  eager={i < 3}
                />
                <span className="guide-body">
                  <span className="guide-kicker">{c.tag}</span>
                  <span className="guide-title">{c.name}</span>
                  <span className="guide-sum">{c.note}</span>
                  <span className="card-meta">
                    {[...new Set(c.videos.flatMap((v) => v.covers.split(" · ")))].map(
                      (t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      )
                    )}
                  </span>
                </span>
              </a>

              {/* The videos sit outside the card link so each one is its own
                  link, not swallowed by the channel link. */}
              <ul className="channel-videos">
                {c.videos.map((v) => (
                  <li key={v.id}>
                    <p className="guide-credit">
                      <a href={videoUrl(v.id)} rel="noopener" target="_blank">
                        {v.title}
                      </a>
                      <span className="sep">·</span>
                      <span className="guide-date">{v.length}</span>
                      {v.published && (
                        <>
                          <span className="sep">·</span>
                          <span className="guide-date">{v.published}</span>
                        </>
                      )}
                      {v.guide && (
                        <>
                          <span className="sep">·</span>
                          <Link className="channel-readup" href={`/guides/${v.guide}/`}>
                            our write-up
                          </Link>
                        </>
                      )}
                    </p>

                    {!v.transcribed && (
                      <p className="creator-flag">
                        Not written up
                        {v.why ? <span className="creator-why"> — {v.why}</span> : null}
                      </p>
                    )}

                    {/* Marked moments open YouTube at the second, which is the
                        whole point on a video with no captions to quote. */}
                    {v.marks && v.marks.length > 0 && (
                      <ul className="marks">
                        {v.marks.map((k) => (
                          <li key={k.at}>
                            <a
                              className="mark"
                              href={markUrl(v.id, k.at)}
                              rel="noopener"
                              target="_blank"
                            >
                              <span className="mark-time">{k.clock}</span>
                              <span className="mark-label">{k.label}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="guide-notes">
        <aside className="callout is-critical">
          <span className="callout-label">If this is your channel</span>
          <p>
            You are credited by name and linked on every page that uses your
            work, and the write-ups exist to send people to the original. If you
            would rather not be listed here at all, say so and you come off the
            page — no argument.
          </p>
        </aside>

        <aside className="callout">
          <span className="callout-label">How the list is kept</span>
          <p>
            Channel names, links, video titles, publish dates and run times are
            taken from YouTube itself rather than typed from memory, so what is
            printed here is what is on the channel. Anything marked{" "}
            <em>not written up</em> is listed but has no guide behind it, and
            says why — usually that the video carries no captions, so the only
            way to get it is to watch it.
          </p>
        </aside>
      </div>
    </DocShell>
  );
}
