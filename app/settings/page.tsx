import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import SectionHead from "@/components/SectionHead";
import Callout from "@/components/Callout";
import Table from "@/components/Table";
import { flightSettings, mouseCamps } from "@/data/settings";

export const metadata: Metadata = {
  title: "Settings first",
  description:
    "WARDOGS helicopter settings: rotary vehicle mouse control, the roll-versus-yaw mouse split, sensitivity values that work, axis isolation, flight assist, HOTAS and controller setup.",
};

export default function SettingsPage() {
  return (
    <>
      <PageHead
        eyebrow="Setup"
        title="Settings"
        accent="first."
        lede="Before you touch a helicopter, go to <strong>Settings → Controls</strong> and scroll to the rotary / air vehicle block. Every single guide opens with the same instruction, so treat it as mandatory rather than preference."
      />

      <Callout label="Non-negotiable" critical>
        <p>
          <strong>Rotary Vehicle Mouse Control → Enabled.</strong> Without
          analogue mouse input you only have digital keys, which move a control
          0% or 100% with nothing in between. Several maneuvers genuinely cannot
          be flown on keys alone, and gunnery is hopeless.
        </p>
      </Callout>

      <section className="section">
        <Table caption="Settings → Controls → rotary / air vehicle">
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                <th>What it does</th>
                <th>What pilots use</th>
              </tr>
            </thead>
            <tbody>
              {flightSettings.map((s) => (
                <tr key={s.setting}>
                  <td>{s.setting}</td>
                  <td dangerouslySetInnerHTML={{ __html: s.does }} />
                  <td
                    className={s.consensus ? "agreed" : undefined}
                    dangerouslySetInnerHTML={{ __html: s.use }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="The one real split"
          title="Roll-mouse or yaw-mouse. Pick a camp."
          lede="The horizontal mouse axis is the only genuine disagreement in the community, and it changes how the aircraft feels more than any keybind does."
        />

        <Table>
          <table>
            <thead>
              <tr>
                <th>Mouse L/R set to…</th>
                <th>Feels like</th>
                <th>Best for</th>
                <th>Cost</th>
              </tr>
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

        <div className="prose after-table">
          <p>
            If you intend to shoot things, take yaw. If you intend to move
            troops, either works. The sensitivity method everybody agrees on:{" "}
            <strong>set it to 100%, then reduce until it stops feeling twitchy.</strong>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="grid grid-2">
          <article className="card">
            <h3 className="card-title">HOTAS</h3>
            <p className="card-body">
              <strong>Settings → Gamepad → HOTAS tab → Enable</strong>, which
              reveals the axis bindings. Roll, pitch and yaw on the stick at
              roughly 3.5 sensitivity; bind collective to the throttle lever and{" "}
              <strong>invert it</strong> so pushing the throttle forward raises
              the collective. Very sensitive out of the box — expect to dial it
              back.
            </p>
          </article>

          <article className="card">
            <h3 className="card-title">Controller</h3>
            <p className="card-body">
              Right trigger is collective — hold it to start the engine and to
              climb. Left stick is the cyclic. Turning is genuinely awkward: you
              bank, then pitch up slightly and let the airframe&rsquo;s weight
              carry the nose round. Start in an MH-6, because the smallest
              airframe teaches the momentum fastest.
            </p>
          </article>
        </div>
      </section>

      <nav className="pager" aria-label="Next">
        <Link className="btn btn-secondary" href="/keybinds/">
          Next: keybind layouts
        </Link>
      </nav>
    </>
  );
}
