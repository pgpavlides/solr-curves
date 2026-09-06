import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import SectionHead from "@/components/SectionHead";
import Table from "@/components/Table";
import Scene from "@/components/three/Scene";
import { dropHeights, crates } from "@/data/numbers";

export const metadata: Metadata = {
  title: "Numbers that get people killed",
  description:
    "WARDOGS passenger drop heights by AGL shown to scale in 3D, supply crate drop ceilings, and how to read AGL versus ASL before telling anyone to jump.",
};

export default function NumbersPage() {
  return (
    <>
      <PageHead
        eyebrow="Hard limits"
        title="Numbers that get people"
        accent="killed."
        lede="Read <strong>AGL</strong> — above ground level — off the HUD before you tell anyone to jump. <strong>ASL</strong> (above sea level) is the other readout, and it is what you use to plan terrain and obstacle clearance, because AGL changes as the ground rises underneath you."
      />

      <section className="section">
        <Scene name="drop" />
      </section>

      <section className="section">
        <Table caption="Passenger drop height, AGL">
          <table>
            <thead>
              <tr>
                <th>Band</th>
                <th className="num">AGL</th>
                <th>Outcome</th>
              </tr>
            </thead>
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
          Leading rule brightness marks severity — <span className="k k1" /> safe,{" "}
          <span className="k k2" /> degraded, <span className="k k3" /> fatal.
        </p>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Cargo"
          title="Supply crates."
          lede="Both types also break on high-speed impact regardless of height — fling them out in a hard turn and they shatter on landing, and you eat the cost."
        />

        <Table>
          <table>
            <thead>
              <tr>
                <th>Crate</th>
                <th className="num">Max drop</th>
                <th>Protection</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {crates.map((c) => (
                <tr key={c.crate}>
                  <td>
                    <b>{c.crate}</b>
                  </td>
                  <td className="num">{c.maxDrop}</td>
                  <td>{c.protection}</td>
                  <td>{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>

        <div className="prose after-table">
          <p>
            Each crate occupies <strong>two passenger seats</strong>, and you can
            carry <strong>two crates</strong> — so a fully loaded logistics run
            leaves you one infantry slot.
          </p>
        </div>
      </section>

      <nav className="pager" aria-label="Next">
        <Link className="btn btn-secondary" href="/fleet/">
          Next: the fleet
        </Link>
      </nav>
    </>
  );
}
