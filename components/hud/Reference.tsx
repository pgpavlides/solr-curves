"use client";

import { useEffect, useRef } from "react";
import Callout from "@/components/Callout";
import Table from "@/components/Table";
import { controls } from "@/data/controls";
import { flightSettings, mouseCamps } from "@/data/settings";
import { layouts, bindRows, hotkeys } from "@/data/keybinds";
import { drills, jhookMistakes, survival } from "@/data/flying";
import { supplies, habits } from "@/data/supplies";
import { dropHeights, crates, payouts } from "@/data/numbers";
import { fleet, money } from "@/data/fleet";
import { glossary } from "@/data/glossary";
import { videos, url } from "@/data/videos";
import { transcriptCount } from "@/data/meta";

export const TABS = [
  "Controls",
  "Settings",
  "Keybinds",
  "Flying",
  "Logistics",
  "Numbers",
  "Fleet",
  "Glossary",
  "Sources",
] as const;
export type Tab = (typeof TABS)[number];

/** Split "W / S" into keycaps and the plain text between them. */
function renderCell(cell: string) {
  return cell.split(/(\s\/\s|\s\+\s)/).map((chunk, i) => {
    const t = chunk.trim();
    const plain = /mouse|keys|button/i.test(t) || t === "" || t === "/" || t === "+";
    return plain ? <span key={i}>{chunk}</span> : <kbd key={i}>{t}</kbd>;
  });
}

export default function Reference({
  open,
  tab,
  onTab,
  onClose,
}: {
  open: boolean;
  tab: Tab;
  onTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const body = useRef<HTMLDivElement>(null);

  // Escape closes; switching tabs returns you to the top of the new one.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <aside
      className={`drawer${open ? " is-open" : ""}`}
      aria-hidden={!open}
      aria-label="Reference"
    >
      <div className="drawer-head">
        <div className="drawer-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === tab}
              className={`drawer-tab${t === tab ? " is-active" : ""}`}
              onClick={() => onTab(t)}
              tabIndex={open ? 0 : -1}
            >
              {t}
            </button>
          ))}
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onClose} tabIndex={open ? 0 : -1}>
          Close
        </button>
      </div>

      <div className="drawer-body" ref={body}>
        {tab === "Controls" && (
          <section>
            <h3>The four controls</h3>
            <p className="lede">
              A helicopter has one engine driving one rotor, and four ways to point
              the force it makes. Every maneuver in the simulator comes back to these.
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
        )}

        {tab === "Settings" && (
          <section>
            <h3>Settings first</h3>
            <p className="lede">
              <strong>Settings → Controls</strong>, then scroll to the rotary / air
              vehicle block. Every guide opens with the same instruction.
            </p>
            <Callout label="Non-negotiable" critical>
              <p>
                <strong>Rotary Vehicle Mouse Control → Enabled.</strong> Without
                analogue mouse input you only have digital keys, which move a control
                0% or 100% with nothing in between. Several maneuvers genuinely
                cannot be flown on keys alone.
              </p>
            </Callout>
            <div className="spaced">
              <Table caption="Settings → Controls → rotary / air vehicle">
                <table>
                  <thead>
                    <tr><th>Setting</th><th>What it does</th><th>What pilots use</th></tr>
                  </thead>
                  <tbody>
                    {flightSettings.map((s) => (
                      <tr key={s.setting}>
                        <td>{s.setting}</td>
                        <td dangerouslySetInnerHTML={{ __html: s.does }} />
                        <td className={s.consensus ? "agreed" : undefined} dangerouslySetInnerHTML={{ __html: s.use }} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Table>
            </div>
            <h4>Roll-mouse or yaw-mouse — the one real split</h4>
            <Table>
              <table>
                <thead>
                  <tr><th>Mouse L/R</th><th>Feels like</th><th>Best for</th><th>Cost</th></tr>
                </thead>
                <tbody>
                  {mouseCamps.map((m) => (
                    <tr key={m.feels}>
                      <td dangerouslySetInnerHTML={{ __html: m.axis }} />
                      <td>{m.feels}</td>
                      <td>{m.bestFor}</td>
                      <td>{m.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
            <div className="prose spaced">
              <p>
                Sensitivity method everybody agrees on:{" "}
                <strong>set it to 100%, then reduce until it stops feeling twitchy.</strong>
              </p>
            </div>
          </section>
        )}

        {tab === "Keybinds" && (
          <section>
            <h3>Three keybind layouts</h3>
            <p className="lede">
              None is correct. The only thing every source agrees on is that the
              layout has to fit your hands.
            </p>
            <Callout label="Check the defaults yourself" critical>
              <p>
                Sources contradict each other on what the game ships with — some
                playtests had collective on <kbd>W</kbd>/<kbd>S</kbd>, others on{" "}
                <kbd>L Shift</kbd>/<kbd>L Ctrl</kbd>. Binding collective to{" "}
                <kbd>Space</kbd> has unbound parachute deploy. Open the menu and look.
              </p>
            </Callout>
            <div className="spaced">
              <Table caption="Keybindings → Rotary Vehicle">
                <table>
                  <thead>
                    <tr>
                      <th>Function</th>
                      {layouts.map((l) => (
                        <th key={l.name}>
                          {l.name}
                          <span className="col-note">{l.note}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bindRows.map((r) => (
                      <tr key={r.fn}>
                        <td>{r.fn}</td>
                        {r.keys.map((cell, i) => (
                          <td key={i} className="keys">{renderCell(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Table>
            </div>
            <h4>Bind these too — they get forgotten</h4>
            <Table>
              <table>
                <thead><tr><th>Function</th><th>Default</th><th>Why it matters</th></tr></thead>
                <tbody>
                  {hotkeys.map((h) => (
                    <tr key={h.fn}>
                      <td>{h.fn}</td>
                      <td className="keys">
                        {h.key === "unbound" ? <span className="unbound">unbound</span> : <kbd>{h.key}</kbd>}
                      </td>
                      <td dangerouslySetInnerHTML={{ __html: h.why }} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
          </section>
        )}

        {tab === "Flying" && (
          <section>
            <h3>The practice syllabus</h3>
            <p className="lede">
              All of this happens in the Firing Range and none of it happens in a
              match. Each drill assumes the one before it.
            </p>
            <ol className="steps">
              {drills.map((d) => (
                <li key={d.title}>
                  <div>
                    <b>{d.title}</b>
                    <span>{d.detail}</span>
                  </div>
                </li>
              ))}
            </ol>
            <h4>J-hook mistakes</h4>
            <div className="prose">
              <ul>
                {jhookMistakes.map((m, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: m }} />
                ))}
              </ul>
            </div>
            <h4>Not getting shot down</h4>
            <div className="prose">
              <ul>
                {survival.map((s, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
                ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "Logistics" && (
          <section>
            <h3>Logistics and the pilot economy</h3>
            <p className="lede">
              WARDOGS is not scored on kills — it is scored on keeping people in the
              circle and the bases fed.
            </p>
            <Callout label="Turn your markup off for the opening FOB" critical>
              <p>
                A FOB is roughly <strong>$2,500</strong> base. Leave the default{" "}
                <strong>25% markup</strong> on and you are charging a teammate an
                extra ~$625 in the first two minutes, which nobody pays and which
                stalls your own team&rsquo;s build. The setting does not persist
                between crates.
              </p>
            </Callout>
            <div className="spaced">
              <Table>
                <table>
                  <thead><tr><th>Supply</th><th>Feeds</th><th>When it is in demand</th></tr></thead>
                  <tbody>
                    {supplies.map((s) => (
                      <tr key={s.supply}>
                        <td><b>{s.supply}</b></td>
                        <td>{s.feeds}</td>
                        <td>{s.demand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Table>
            </div>
            <div className="grid grid-2 spaced">
              <Callout label="Pallets over boxes">
                <p>
                  A <strong>pallet</strong> unloads straight into the FOB in range. A{" "}
                  <strong>supply box</strong> has to be hand-carried in over several
                  trips, under fire. Take pallets.
                </p>
              </Callout>
              <article className="card">
                <span className="card-eyebrow">Payouts</span>
                <ul className="tight">
                  {payouts.map((p, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: p }} />
                  ))}
                </ul>
              </article>
            </div>
            <h4>Habits that make you worth flying with</h4>
            <div className="prose">
              <ul>
                {habits.map((h, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: h }} />
                ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "Numbers" && (
          <section>
            <h3>Numbers that get people killed</h3>
            <p className="lede">
              Read <strong>AGL</strong> off the HUD before you tell anyone to jump.
              The telemetry readout in the simulator is genuine AGL — the model&rsquo;s
              skids sit at ground level.
            </p>
            <Table caption="Passenger drop height, AGL">
              <table>
                <thead><tr><th>Band</th><th className="num">AGL</th><th>Outcome</th></tr></thead>
                <tbody>
                  {dropHeights.map((d) => (
                    <tr key={d.band} className={`sev sev-${d.sev}`}>
                      <td>{d.band}</td>
                      <td className="num">{d.agl}</td>
                      <td>{d.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
            <p className="legend">
              Rule brightness marks severity — <span className="k k1" /> safe,{" "}
              <span className="k k2" /> degraded, <span className="k k3" /> fatal.
            </p>
            <h4>Supply crates</h4>
            <Table>
              <table>
                <thead>
                  <tr><th>Crate</th><th className="num">Max drop</th><th>Protection</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {crates.map((c) => (
                    <tr key={c.crate}>
                      <td><b>{c.crate}</b></td>
                      <td className="num">{c.maxDrop}</td>
                      <td>{c.protection}</td>
                      <td>{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
            <div className="prose spaced">
              <p>
                Each crate takes <strong>two passenger seats</strong> and you can carry{" "}
                <strong>two</strong> — a full logistics run leaves one infantry slot.
              </p>
            </div>
          </section>
        )}

        {tab === "Fleet" && (
          <section>
            <h3>The fleet</h3>
            <p className="lede">
              Six airframes. The one in the simulator is an MD530-family Little Bird
              with a true 8.33 m rotor.
            </p>
            <Table>
              <table>
                <thead>
                  <tr><th>Airframe</th><th className="num">Cost</th><th className="num">Seats</th><th>Role</th></tr>
                </thead>
                <tbody>
                  {fleet.map((f) => (
                    <tr key={`${f.name}-${f.variant ?? ""}`}>
                      <td>
                        <b>{f.name}</b>
                        {f.variant && <span className="variant"> {f.variant}</span>}
                      </td>
                      <td className="num">{money(f.cost)}</td>
                      <td className="num">{f.seats}</td>
                      <td>{f.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
            <div className="prose spaced">
              <p>
                Landing at main base auto-refuels and repairs. Rotor damage needs a
                wrench; one wrench covers two repairs.
              </p>
            </div>
          </section>
        )}

        {tab === "Glossary" && (
          <section>
            <h3>Glossary</h3>
            <p className="lede">
              Terms of art, in the plainest language they survive. Most are real
              rotary-wing vocabulary the game inherits without explaining.
            </p>
            <dl className="defs">
              {glossary.map((g) => (
                <div key={g.term}>
                  <dt>{g.term}</dt>
                  <dd dangerouslySetInnerHTML={{ __html: g.def }} />
                </div>
              ))}
            </dl>
          </section>
        )}

        {tab === "Sources" && (
          <section>
            <h3>Sources</h3>
            <p className="lede">
              Captions were pulled from {transcriptCount} community tutorials and read
              in full. Where creators disagreed, the disagreement is stated rather
              than smoothed over.
            </p>
            <Callout label="A warning about the “wiki” sites" critical>
              <p>
                Search for WARDOGS helicopter guides and you hit a cluster of
                near-identical generated SEO sites that contradict each other and
                cite settings appearing in no gameplay footage. None were used here.
              </p>
            </Callout>
            <ul className="sources spaced">
              {videos.map((v) => (
                <li key={v.id}>
                  <span className="chan">{v.channel}</span>
                  <a className="title" href={url(v.id)} rel="noopener" target="_blank">
                    {v.title}
                    <span className="chip">{v.covers}</span>
                  </a>
                  <span className="len">{v.length}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
