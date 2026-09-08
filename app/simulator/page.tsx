import type { Metadata, Viewport } from "next";
import App from "@/components/App";
import { ogCard } from "@/lib/og";
import { maneuvers } from "@/data/maneuvers";
import { glossary } from "@/data/glossary";

export const metadata: Metadata = {
  title: "Simulator — wardogspilot",
  description:
    "Seven WARDOGS helicopter maneuvers flown in 3D with the pilot's collective, cyclic and pedal inputs shown live.",
  openGraph: ogCard("simulator", "The wardogspilot maneuver simulator"),
  twitter: ogCard("simulator", "The wardogspilot maneuver simulator"),
};

/*
  The HUD sits in the corners of a fixed viewport; a zoomed page would push it
  off screen. Only this route locks zoom — the reading pages must stay
  zoomable.
*/
export const viewport: Viewport = { maximumScale: 1 };

/*
  This route is the application. The only server-rendered markup is the
  <noscript> block below: the experience is WebGL/WebGPU and cannot be
  prerendered, so crawlers and anyone without scripts get the substance as
  plain text rather than an empty shell.

  The GLB preload lives here rather than in the root layout — it is 1.9 MB and
  nothing outside this route needs it.
*/
export default function SimulatorPage() {
  return (
    <>
      {/* React hoists this into <head>; only this route pays for it. */}
      <link rel="preload" as="fetch" href="/heli.glb" crossOrigin="anonymous" />
      <App />
      <noscript>
        <div style={{ padding: "32px 24px", maxWidth: 760, margin: "0 auto" }}>
          <h1>wardogspilot — WARDOGS helicopter reference</h1>
          <p>
            The interactive simulator needs JavaScript and WebGL. The reference
            material it contains is summarised here.
          </p>
          <h2>Maneuvers</h2>
          <ul>
            {maneuvers.map((m) => (
              <li key={m.id}>
                <b>{m.name}</b> — {m.blurb}
              </li>
            ))}
          </ul>
          <h2>Terminology</h2>
          <dl>
            {glossary.map((g) => (
              <div key={g.term}>
                <dt>
                  <b>{g.term}</b>
                </dt>
                <dd dangerouslySetInnerHTML={{ __html: g.def }} />
              </div>
            ))}
          </dl>
        </div>
      </noscript>
    </>
  );
}
