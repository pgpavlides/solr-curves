import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import SectionHead from "@/components/SectionHead";
import Scene from "@/components/three/Scene";
import { controls } from "@/data/controls";

export const metadata: Metadata = {
  title: "The four controls",
  description:
    "Collective, cyclic, yaw and the lift vector explained — what each control actually does in a helicopter, and what WARDOGS calls it in the keybind menu.",
};

export default function ControlsPage() {
  return (
    <>
      <PageHead
        eyebrow="Fundamentals"
        title="The four"
        accent="controls."
        lede="A helicopter has one engine driving one rotor, and four ways to point the force it makes. Every guide, every maneuver and every crash comes back to these. Learn what the word means in the aircraft first, then what key it sits on."
      />

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

      <section className="section">
        <SectionHead
          eyebrow="Tilt it yourself"
          title="Where the lift actually goes."
          lede="The rotor makes force in exactly one direction — perpendicular to the disc. Bank it and watch the vertical half shrink."
        />
        <Scene name="lift" />
      </section>

      <nav className="pager" aria-label="Next">
        <Link className="btn btn-secondary" href="/settings/">
          Next: settings first
        </Link>
      </nav>
    </>
  );
}
