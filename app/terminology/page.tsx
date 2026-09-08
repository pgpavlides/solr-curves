import type { Metadata } from "next";
import Link from "next/link";
import DocShell from "@/components/DocShell";
import { ogCard } from "@/lib/og";
import TermExplorer from "@/components/TermExplorer";
import { listedTerms, termCount } from "@/data/glossary";
import { controls } from "@/data/controls";

export const metadata: Metadata = {
  title: "Terminology — wardogspilot",
  description:
    "Helicopter terminology as WARDOGS uses it: collective, cyclic, yaw, lift vector, crab, flare, J-hook, AGL and ASL — what each word actually means, and the traps in them.",
  openGraph: ogCard("terminology", "WARDOGS helicopter terminology"),
  twitter: ogCard("terminology", "WARDOGS helicopter terminology"),
};

export default function TerminologyPage() {
  return (
    <DocShell wide crumb={{ href: "/", label: "Home" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Reference</span>
        <h1>Terminology</h1>
        <p className="doc-lede">
          Most of this is real rotary-wing vocabulary that WARDOGS inherits and
          never explains. Search it, or read it straight through — the four
          controls come first, because every other word here is really a
          statement about one of them.
        </p>
        <p className="doc-count">
          {termCount} terms · every one linkable, e.g.{" "}
          <a href="#crab">/terminology/#crab</a>
        </p>
      </header>

      <aside className="credit credit-row">
        <div className="credit-text">
          <span className="credit-label">Terminology throughout leans on</span>
          <p className="credit-channel">
            <a
              href="https://www.youtube.com/@CologneTM"
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
        </div>
        <Link className="btn btn-sm" href="/guides/j-hook-cologne/">
          Read the J-hook guide
        </Link>
      </aside>

      <TermExplorer controls={controls} terms={listedTerms} />

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
