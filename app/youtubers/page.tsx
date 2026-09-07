import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import YouTubeThumb from "@/components/YouTubeThumb";
import {
  creators,
  creatorCount,
  creatorVideoCount,
  videoUrl,
} from "@/data/creators";

export const metadata: Metadata = {
  title: "Youtubers — wardogspilot",
  description:
    "Every creator this site learned from: the channels, what each one is good for, and every WARDOGS helicopter video we went through — all linked straight back to them.",
};

/*
  The credit page. Nothing here is a summary of someone's video — it is a
  pointer to it. Channel names and video titles are the canonical ones from
  YouTube, so what is printed here matches what is on their channel.
*/
export default function Youtubers() {
  const transcribed = creators.reduce(
    (n, c) => n + c.videos.filter((v) => v.transcribed).length,
    0
  );

  return (
    <DocShell wide crumb={{ href: "/guides/", label: "All guides" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Youtubers</span>
        <h1>The people this is built on.</h1>
        <p className="doc-lede">
          None of what is on this site is original flying. It is their work,
          read carefully and written down in one place. Every channel below is
          worth your time directly — go and watch them, and subscribe.
        </p>
        <p className="doc-count">
          {creatorCount} creators · {creatorVideoCount} videos · {transcribed}{" "}
          gone through in full
        </p>
      </header>

      <ul className="creator-list">
        {creators.map((c) => (
          <li key={c.name} className="creator">
            <div className="creator-head">
              <div className="creator-id">
                <span className="creator-tag">{c.tag}</span>
                <h2 className="creator-name">
                  <a href={c.channelUrl} rel="noopener" target="_blank">
                    {c.name}
                  </a>
                </h2>
                <p className="creator-note">{c.note}</p>
              </div>
              <a
                className="btn btn-sm"
                href={c.channelUrl}
                rel="noopener"
                target="_blank"
              >
                Visit the channel
              </a>
            </div>

            <ul className="creator-videos">
              {c.videos.map((v) => (
                <li key={v.id} className="creator-video">
                  <a
                    className="creator-thumb"
                    href={videoUrl(v.id)}
                    rel="noopener"
                    target="_blank"
                    aria-label={`Watch ${v.title} by ${c.name} on YouTube`}
                  >
                    <YouTubeThumb
                      videoId={v.id}
                      alt=""
                      duration={v.length === "—" ? undefined : v.length}
                    />
                  </a>
                  <div className="creator-video-text">
                    <a
                      className="creator-video-title"
                      href={videoUrl(v.id)}
                      rel="noopener"
                      target="_blank"
                    >
                      {v.title}
                    </a>
                    <p className="creator-video-meta">
                      <span className="chip">{v.covers}</span>
                      {!v.transcribed && (
                        <span className="creator-flag">not written up</span>
                      )}
                    </p>
                    {v.guide && (
                      <Link className="creator-guide" href={`/guides/${v.guide}/`}>
                        Read our write-up →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
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
            Channel names, links and video titles are taken from YouTube itself
            rather than typed from memory, so a name here is the name on the
            channel. Anything marked <em>not written up</em> is listed but has
            not been read through — usually because no captions were available.
          </p>
        </aside>
      </div>
    </DocShell>
  );
}
