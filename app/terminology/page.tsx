import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import TermExplorer from "@/components/TermExplorer";
import { ogCard } from "@/lib/og";
import { entries, termCount } from "@/data/glossary";

export const metadata: Metadata = {
  title: "Terminology — wardogspilot",
  description:
    "Helicopter terminology as WARDOGS uses it: collective, cyclic, yaw, lift vector, crab, flare, J-hook, AGL and ASL — what each word actually means, and the traps in them.",
  openGraph: ogCard("terminology", "WARDOGS helicopter terminology"),
  twitter: ogCard("terminology", "WARDOGS helicopter terminology"),
};

/*
  This route is a fixed one-screen layout, not a document, so a zoomed page
  would push the panes off the bottom rather than reflowing. Same reasoning as
  the simulator.
*/
export const viewport: Viewport = { maximumScale: 1 };

/*
  Terminology, as a panel rather than a page.

  DocShell is deliberately not used here: it is chrome for scrolling reading
  pages, with a footer under the fold, and this route has no fold. The bar
  below is the same brand mark and the same nav, sized to leave the rest of the
  viewport to the explorer.
*/
export default function TerminologyPage() {
  return (
    <div className="tm">
      <header className="tm-bar">
        <Link className="doc-brand" href="/">
          <span className="logo-wrap">
            <Logo />
          </span>
          <span>
            <span className="brand-word">wardogspilot</span>
            <span className="brand-sub">Terminology</span>
          </span>
        </Link>

        <nav className="tm-nav">
          <Link className="btn btn-sm btn-ghost" href="/">
            Home
          </Link>
          <Link className="btn btn-sm btn-ghost" href="/videos/">
            Videos
          </Link>
          <Link className="btn btn-sm" href="/simulator/">
            Simulator
          </Link>
        </nav>
      </header>

      <TermExplorer entries={entries} />

      <noscript>
        <p style={{ padding: "12px 24px", color: "#a8aebb" }}>
          {termCount} terms. Without JavaScript the section cards do not switch,
          but every definition is on this page and every one has its own link.
        </p>
      </noscript>
    </div>
  );
}
