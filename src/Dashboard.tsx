import type { ReactNode } from "react";
import type { PadLike } from "./gamepad";
import type { Sync } from "./TargetPanel";
import type { VoiceConfig } from "./voice";

/*
  The first thing you see: the logo, then a card for each part of the app with
  a line of what it's doing right now. Click a card to go there; the logo in
  the header brings you back here.
*/

export type Page = "curves" | "macros" | "script" | "devices";

interface Props {
  onOpen: (p: Page) => void;
  sync: Sync;
  preset: string | null;
  stick: PadLike | null;
  cfg: VoiceConfig;
  bank: number | null;
}

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const ICONS: Record<Page, ReactNode> = {
  curves: icon(<><path d="M3 20c5 0 6-16 9-16s4 16 9 16" /><path d="M3 12h18" opacity=".35" /></>),
  macros: icon(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h2M11 10h2M15 10h2M7 14h10" /></>),
  script: icon(<><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" /></>),
  devices: icon(<><circle cx="12" cy="7" r="3" /><path d="M12 10v6M7 20h10l-1.5-4h-7z" /></>),
};

export default function Dashboard({ onOpen, sync, preset, stick, cfg, bank }: Props) {
  const b = bank !== null ? cfg.banks[bank] : null;
  const macros = cfg.banks.reduce((n, x) => n + Object.values(x.macros ?? {}).filter((m) => m?.steps).length, 0);
  const sounds = cfg.banks.reduce((n, x) => n + Object.values(x.pads ?? {}).filter(Boolean).length, 0);
  const live = sync === "live";

  const cards: { page: Page; title: string; blurb: string; status: string; ok: boolean; accent: string }[] = [
    {
      page: "curves", title: "Curves", accent: "#39ff6a",
      blurb: "Shape how roll, pitch and yaw answer your hand",
      status: preset ? `Preset ${preset}` : "No preset loaded", ok: !!preset,
    },
    {
      page: "macros", title: "Macros", accent: "#2f9bff",
      blurb: "Sounds and key sequences on every button, per bank",
      status: b ? `${b.name} on the knob · ${macros} macros · ${sounds} sounds` : `${macros} macros · ${sounds} sounds`, ok: true,
    },
    {
      page: "script", title: "Script", accent: "#ffb020",
      blurb: "The T.A.R.G.E.T. script that runs the stick",
      status: live ? "Running - live in T.A.R.G.E.T." : sync === "loading" ? "Starting..." : "Not running", ok: live,
    },
    {
      page: "devices", title: "Devices", accent: "#ff5fb4",
      blurb: "The stick, its buttons, LEDs and switches",
      status: stick ? "Sol-R [R] Flightstick connected" : "Stick not found", ok: !!stick,
    },
  ];

  return (
    <div className="dash">
      <div className="dash-hero">
        <img src="/logo.png" alt="" className="dash-logo" />
        <div>
          <h1>Sol-R Curves</h1>
          <p>WARDOGS · Sol-R [R] Flightstick · live into T.A.R.G.E.T.</p>
        </div>
      </div>
      <div className="dash-cards">
        {cards.map((c) => (
          <button key={c.page} className="dash-card" style={{ ["--c" as string]: c.accent }} onClick={() => onOpen(c.page)}>
            <span className="dash-icon">{ICONS[c.page]}</span>
            <b>{c.title}</b>
            <span className="dash-blurb">{c.blurb}</span>
            <span className={`dash-status ${c.ok ? "ok" : ""}`}><i />{c.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
