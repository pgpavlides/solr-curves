import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import { GROUPS, byGroup } from "@/data/glossary";
import { controls } from "@/data/controls";

export const metadata: Metadata = {
  title: "Terminology — wardogspilot",
  description:
    "Helicopter terminology as WARDOGS uses it: collective, cyclic, yaw, lift vector, crab, flare, J-hook, AGL and ASL — what each word actually means, and the traps in them.",
};

export default function TerminologyPage() {
  return (
    <DocShell crumb={{ href: "/guides/", label: "Guides" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Reference</span>
        <h1>Terminology</h1>
        <p className="doc-lede">
          Most of this is real rotary-wing vocabulary that WARDOGS inherits and
          never explains. The four controls come first, because every other word
          on this page is really a statement about one of them.
        </p>
      </header>

      <aside className="credit">
        <span className="credit-label">Terminology throughout leans on</span>
        <p className="credit-channel">
          <a
            href="https://www.youtube.com/channel/UCULPLRn4k4LlSDxaqKOAiVw"
            rel="noopener"
            target="_blank"
          >
            Cologne TM
          </a>
        </p>
        <p className="credit-title">
          A working helicopter pilot with 3,000 hours on real aircraft, who
          defines the axes properly in his WARDOGS tutorials.
        </p>
        <Link className="btn btn-sm" href="/guides/j-hook-cologne/">
          Read the J-hook guide
        </Link>
      </aside>

      {/* The four controls get the long form; everything else is a definition. */}
      <section className="doc-section" id="controls">
        <h2>The four controls</h2>
        <p className="doc-p">
          A helicopter has one engine driving one rotor, and four ways to point
          the force it makes.
        </p>
        <dl className="defs controls-list">
          {controls.map((c) => (
            <div key={c.name}>
              <dt>
                {c.name}
                <span className="tag">{c.tag}</span>
              </dt>
              <dd>
                {c.real.map((p, i) => (
                  <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
                ))}
                <p className="ingame">
                  <b>In WARDOGS:</b>{" "}
                  <span dangerouslySetInnerHTML={{ __html: c.inGame }} />
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {GROUPS.map((g) => {
        const terms = byGroup(g);
        if (!terms.length) return null;
        return (
          <section key={g} className="doc-section" id={g.toLowerCase().replace(/\s+/g, "-")}>
            <h2>{g}</h2>
            <dl className="defs term-list">
              {terms.map((t) => (
                <div key={t.term}>
                  <dt>{t.term}</dt>
                  <dd>
                    <span dangerouslySetInnerHTML={{ __html: t.def }} />
                    {t.note && (
                      <span className="term-note" dangerouslySetInnerHTML={{ __html: t.note }} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      <aside className="callout spaced">
        <span className="callout-label">One word used two ways</span>
        <p>
          Watch for <strong>flare</strong> — it is both the nose-up deceleration
          near the ground and the countermeasure you fire at a missile. And
          <strong> skid</strong> is a flight condition, while <strong>the
          skids</strong> are the landing gear you park on.
        </p>
      </aside>
    </DocShell>
  );
}
