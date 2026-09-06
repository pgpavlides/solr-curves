import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import Callout from "@/components/Callout";
import { videos, url } from "@/data/videos";
import { transcriptCount } from "@/data/meta";

export const metadata: Metadata = {
  title: "Source videos",
  description:
    "Every WARDOGS helicopter tutorial used to build this reference, with channel, length and what each one covers.",
};

export default function VideosPage() {
  const read = videos.filter((v) => v.transcribed);
  const unread = videos.filter((v) => !v.transcribed);

  return (
    <>
      <PageHead
        eyebrow="Sourcing"
        title="Source"
        accent="videos."
        lede={`Captions were pulled from ${transcriptCount} of these and read in full. Where two creators disagreed, the disagreement is stated on the relevant page rather than smoothed over.`}
      />

      <Callout label="A warning about the “wiki” sites" critical>
        <p>
          Search for WARDOGS helicopter guides and you will hit a cluster of
          near-identical sites — wardogswiki.com, thewardogs.wiki,
          wardogsguide.wiki, wardogshub.gg, wardogsguides.com — that are
          generated SEO content, contradict each other, and cite named settings
          (“Stability Assist”, “Envelope Limits”, “Turn Coordination”) that
          appear in no gameplay footage. None of them were used here.
        </p>
      </Callout>

      <section className="section">
        <h2 className="list-head">Read in full</h2>
        <ul className="sources">
          {read.map((v) => (
            <li key={v.id}>
              <span className="chan">{v.channel}</span>
              <a className="title" href={url(v.id)} rel="noopener">
                {v.title}
                <span className="chip">{v.covers}</span>
              </a>
              <span className="len">{v.length}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="list-head">Indexed, not transcribed</h2>
        <p className="list-note">
          No captions available, or gameplay rather than instruction. Listed so
          the index is complete — nothing on this site is sourced from them.
        </p>
        <ul className="sources">
          {unread.map((v) => (
            <li key={v.id}>
              <span className="chan">{v.channel}</span>
              <a className="title" href={url(v.id)} rel="noopener">
                {v.title}
                <span className="chip">{v.covers}</span>
              </a>
              <span className="len">{v.length}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
