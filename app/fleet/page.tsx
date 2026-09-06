import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import SectionHead from "@/components/SectionHead";
import Table from "@/components/Table";
import { fleet, money } from "@/data/fleet";

export const metadata: Metadata = {
  title: "The fleet",
  description:
    "Every WARDOGS helicopter with cost, seat count and role — MH-6, AH-6M, AH-6R, UH-1Y and the Havoc attack helicopter.",
};

export default function FleetPage() {
  return (
    <>
      <PageHead
        eyebrow="Airframes"
        title="The"
        accent="fleet."
        lede="Six airframes, from the $6,250 trainer to the most expensive vehicle in the game. Landing at main base auto-refuels and repairs you; rotor damage needs a wrench, and one wrench covers two repairs."
      />

      <section className="section">
        <Table>
          <table>
            <thead>
              <tr>
                <th>Airframe</th>
                <th className="num">Cost</th>
                <th className="num">Seats</th>
                <th>Role</th>
              </tr>
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
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Gunnery"
          title="Shooting from a Little Bird."
          lede="The miniguns are hard and the payout is poor. Transporting people pays substantially better than gunning until you are in a Havoc."
        />
        <div className="prose">
          <p>
            If you must: aim with the{" "}
            <strong>top-right of the crosshair</strong>, not the centre, and work
            in micro-taps of yaw and pitch, taking straight shots rather than
            tracking.
          </p>
        </div>
      </section>

      <nav className="pager" aria-label="Next">
        <Link className="btn btn-secondary" href="/glossary/">
          Next: glossary
        </Link>
      </nav>
    </>
  );
}
