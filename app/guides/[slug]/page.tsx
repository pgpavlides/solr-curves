import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DocShell from "@/components/DocShell";
import GuideBlocks from "@/components/GuideBlocks";
import YouTubeThumb from "@/components/YouTubeThumb";
import { guides, guideBySlug, videoUrl } from "@/data/guides";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return { title: "Guide — wardogspilot" };
  return {
    title: `${g.title} — wardogspilot`,
    description: `${g.summary} Written up from “${g.source.title}” by ${g.source.channel}.`,
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) notFound();

  return (
    <DocShell crumb={{ href: "/guides/", label: "All guides" }}>
      <article className="doc-article">
        <header className="doc-head">
          <span className="doc-eyebrow">{g.kicker}</span>
          <h1>{g.title}</h1>
          <p className="doc-lede">{g.summary}</p>
        </header>

        {/* Credit sits above the content, not buried at the bottom. */}
        <aside className="credit has-thumb">
          <a
            className="credit-thumb"
            href={videoUrl(g.source.videoId)}
            rel="noopener"
            target="_blank"
            aria-label={`Watch ${g.source.title} by ${g.source.channel} on YouTube`}
          >
            <YouTubeThumb
              videoId={g.source.videoId}
              alt=""
              duration={g.source.duration}
              eager
            />
          </a>
          <div className="credit-text">
            <span className="credit-label">Based on a video by</span>
            <p className="credit-channel">
              <a href={g.source.channelUrl} rel="noopener" target="_blank">
                {g.source.channel}
              </a>
            </p>
            <p className="credit-title">
              <a href={videoUrl(g.source.videoId)} rel="noopener" target="_blank">
                {g.source.title}
              </a>
            </p>
            <p className="credit-meta">
              {g.source.duration} &middot; published {g.source.published}
            </p>
            <a
              className="btn btn-sm"
              href={videoUrl(g.source.videoId)}
              rel="noopener"
              target="_blank"
            >
              Watch the original
            </a>
          </div>
        </aside>

        <nav className="doc-toc" aria-label="Contents">
          <span className="doc-toc-label">On this page</span>
          <ol>
            {g.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>

        {g.sections.map((s) => (
          <section key={s.id} id={s.id} className="doc-section">
            <h2>{s.heading}</h2>
            <GuideBlocks blocks={s.blocks} />
          </section>
        ))}

        <aside className="credit credit-foot">
          <span className="credit-label">Credit</span>
          <p className="doc-p">
            Everything above is a write-up of{" "}
            <a href={videoUrl(g.source.videoId)} rel="noopener" target="_blank">
              {g.source.title}
            </a>{" "}
            by{" "}
            <a href={g.source.channelUrl} rel="noopener" target="_blank">
              {g.source.channel}
            </a>
            . The settings, the numbers and the technique are theirs; the wording
            here is ours. Watch the original for the flying that goes with it.
          </p>
        </aside>
      </article>
    </DocShell>
  );
}
