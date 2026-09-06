"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "./Logo";
import Loader from "./Loader";
import Gauges from "./hud/Gauges";
import Telemetry from "./hud/Telemetry";
import Reference, { type Tab } from "./hud/Reference";
import SceneBoundary from "./three/SceneBoundary";
import { maneuvers } from "@/data/maneuvers";
import { sample } from "@/lib/sample";
import type { CamMode, Sim } from "@/lib/sim";

/*
  WebGL cannot render during a static export, so the canvas is pulled in
  client-side only. This module is already a client component, which is what
  makes `ssr: false` legal in the App Router.
*/
const SimCanvas = dynamic(() => import("./three/SimCanvas"), { ssr: false });

export default function App() {
  // Deliberately NOT seeded from the URL: reading location during the first
  // render makes the server and client disagree and React throws a hydration
  // mismatch. Apply the deep link once, after mount.
  const [manId, setManId] = useState(maneuvers[0].id);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [camMode, setCamMode] = useState<CamMode>("orbit");
  const [phase, setPhase] = useState(0);
  const [scrub, setScrub] = useState(0);
  const [backend, setBackend] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState<Tab>("Controls");

  const man = useMemo(() => maneuvers.find((m) => m.id === manId)!, [manId]);

  const sim = useRef<Sim>({
    t: 0,
    playing: true,
    speed: 1,
    man,
    frame: sample(man, 0),
    hold: 0,
  });

  useEffect(() => { sim.current.playing = playing; }, [playing]);
  useEffect(() => { sim.current.speed = speed; }, [speed]);
  useEffect(() => {
    sim.current.man = man;
    sim.current.t = 0;
    sim.current.hold = 0;
    sim.current.frame = sample(man, 0);
    setPhase(0);
    setScrub(0);
  }, [man]);

  // Phase and scrub follow the sim at a readable rate, not every frame.
  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase(sim.current.frame.phase);
      setScrub(sim.current.t);
    }, 90);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("m");
    if (q && maneuvers.some((m) => m.id === q)) setManId(q);
  }, []);

  const onReady = useCallback((b: string) => setBackend(b), []);
  const onModelReady = useCallback(() => setModelReady(true), []);
  // Both, explicitly. The renderer finishes initialising after the last byte
  // of the model arrives, and the model can resolve before the renderer is up
  // — gating on either one alone shows an empty scene.
  const ready = backend !== null && modelReady;

  // Keyboard: space toggles playback, R opens the reference.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(el.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "r") {
        setDrawer((d) => !d);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (id: string) => {
    setManId(id);
    window.history.replaceState(null, "", `?m=${id}`);
  };

  return (
    <div id="app">
      <a className="skip" href="#rail">Skip to maneuver list</a>

      <div className="stage">
        <SceneBoundary>
          <SimCanvas
            man={man}
            sim={sim}
            camMode={camMode}
            onReady={onReady}
            onModelReady={onModelReady}
          />
        </SceneBoundary>
      </div>

      <div className="hud">
        <div className="panel brand">
          <span className="logo-wrap"><Logo /></span>
          <span>
            <span className="brand-word">wardogspilot</span>
            <span className="brand-sub">Rotary flight guide</span>
          </span>
        </div>

        <div className="hud-actions">
          {backend && <span className="backend-badge">{backend}</span>}
          <button
            className={`btn btn-sm${drawer ? "" : " btn-ghost"}`}
            onClick={() => setDrawer((d) => !d)}
            aria-expanded={drawer}
          >
            Reference
          </button>
        </div>

        <nav className="panel rail" id="rail" aria-label="Maneuvers">
          <span className="hud-label rail-head">Maneuvers</span>
          {maneuvers.map((m) => (
            <button
              key={m.id}
              className={`rail-item${m.id === manId ? " is-active" : ""}`}
              aria-current={m.id === manId ? "true" : undefined}
              onClick={() => pick(m.id)}
            >
              <span className="rail-name">{m.name}</span>
              <span className="rail-tag">{m.tag}</span>
            </button>
          ))}
        </nav>

        <aside className="panel brief is-live">
          <span className="hud-label">{man.tag}</span>
          <h2>{man.name}</h2>
          <p className="blurb">{man.blurb}</p>
          <ol className="phases">
            {man.phases.map((p, i) => (
              <li key={p.title} className={i === phase ? "is-active" : undefined}>
                <div>
                  <strong>{p.title}</strong>
                  <br />
                  {p.detail}
                </div>
              </li>
            ))}
          </ol>
          <div className="watch">
            <span className="hud-label">Watch for</span>
            <p>{man.watchFor}</p>
          </div>
        </aside>

        <div className="deck">
          <Gauges sim={sim} />

          <div className="panel transport">
            <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.002}
              value={scrub}
              aria-label="Scrub through the maneuver"
              onChange={(e) => {
                const v = Number(e.target.value);
                sim.current.t = v;
                sim.current.hold = 0;
                setScrub(v);
                setPlaying(false);
              }}
            />
            <div className="tabs">
              {[0.35, 1].map((s) => (
                <button
                  key={s}
                  className={`tab${speed === s ? " is-active" : ""}`}
                  onClick={() => setSpeed(s)}
                >
                  {s === 1 ? "1×" : "slow"}
                </button>
              ))}
            </div>
            <div className="tabs">
              {(["orbit", "chase"] as const).map((m) => (
                <button
                  key={m}
                  className={`tab${camMode === m ? " is-active" : ""}`}
                  onClick={() => setCamMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <Telemetry sim={sim} />
        </div>
      </div>

      <Reference open={drawer} tab={tab} onTab={setTab} onClose={() => setDrawer(false)} />

      <Loader
        progress={ready ? 100 : backend ? 78 : modelReady ? 55 : 22}
        done={ready}
        note={backend ? (modelReady ? "ready" : "loading airframe") : "starting renderer"}
      />
    </div>
  );
}
