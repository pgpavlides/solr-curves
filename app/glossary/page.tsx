import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import { glossary } from "@/data/glossary";

export const metadata: Metadata = {
  title: "Glossary",
  description:
    "WARDOGS helicopter terminology: collective, cyclic, yaw, lift vector, flare, J-hook, AGL, ASL, weathercocking, nap of the earth and more.",
};

export default function GlossaryPage() {
  return (
    <>
      <PageHead
        eyebrow="Terms of art"
        title="Glossary."
        lede="Nineteen terms, in the plainest language they survive. Most are real rotary-wing vocabulary that the game inherits without explaining."
      />

      <dl className="defs">
        {glossary.map((g) => (
          <div key={g.term}>
            <dt>{g.term}</dt>
            <dd dangerouslySetInnerHTML={{ __html: g.def }} />
          </div>
        ))}
      </dl>

      <nav className="pager" aria-label="Next">
        <Link className="btn btn-secondary" href="/videos/">
          Next: source videos
        </Link>
      </nav>
    </>
  );
}
