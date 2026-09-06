import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import SectionHead from "@/components/SectionHead";
import Callout from "@/components/Callout";
import Scene from "@/components/three/Scene";

export const metadata: Metadata = {
  title: "Maneuver simulator",
  description:
    "Seven WARDOGS helicopter maneuvers flown in 3D with the pilot's collective, cyclic and pedal inputs shown live — hover, takeoff, transition, level turn, quick stop, pedal turn and the J-hook.",
};

export default function ManeuversPage() {
  return (
    <>
      <PageHead
        eyebrow="Simulator"
        title="Watch the"
        accent="inputs."
        lede="Seven maneuvers, flown correctly, with the collective, cyclic and pedals shown moving as the aircraft moves. Reading that a bank costs you lift is one thing; watching the collective climb to pay for it is another."
      />

      <Scene name="maneuvers" />

      <section className="section">
        <SectionHead
          eyebrow="How to read it"
          title="Three controls, one timeline."
          lede="Every maneuver is an authored timeline rather than a physics simulation, so it shows the correct execution every time instead of whatever the solver happens to do."
        />
        <div className="grid grid-2">
          <Callout label="The gauges are the point">
            <p>
              The <strong>collective</strong> bar is total power and altitude. The{" "}
              <strong>cyclic</strong> box is the stick between the pilot&rsquo;s
              knees — up and down is speed, left and right is bank. The{" "}
              <strong>pedals</strong> are the tail rotor, pointing the nose
              independently of where the aircraft is travelling.
            </p>
            <p>
              Slow it down and scrub if a maneuver goes past too fast. The
              <em> chase</em> camera is better for judging attitude; <em>orbit</em>{" "}
              is better for seeing the shape of the track.
            </p>
          </Callout>
          <Callout label="The model">
            <p>
              An MD530-family Little Bird, 8.33 m rotor, exported from Blender
              with the main and tail rotors split onto their real axes so they
              turn where they actually turn. The skids sit at ground level, so
              the altitude readout is genuinely AGL.
            </p>
            <p>
              Rendered with three.js on <strong>WebGPU</strong>, falling back to
              WebGL2 automatically where WebGPU is not available — the viewport
              label says which one you got.
            </p>
          </Callout>
        </div>
      </section>

      <nav className="pager" aria-label="Next">
        <Link className="btn btn-secondary" href="/flying/">
          Next: the flying syllabus
        </Link>
      </nav>
    </>
  );
}
