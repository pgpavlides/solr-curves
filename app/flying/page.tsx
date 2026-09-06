import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import SectionHead from "@/components/SectionHead";
import Callout from "@/components/Callout";
import Scene from "@/components/three/Scene";
import { drills, jhookMistakes, survival } from "@/data/flying";

export const metadata: Metadata = {
  title: "Flying and the J-hook",
  description:
    "A nine-drill WARDOGS practice syllabus for the firing range, the J-hook as an interactive 3D flight path, the mistakes that ruin it, and what actually gets helicopters shot down.",
};

export default function FlyingPage() {
  return (
    <>
      <PageHead
        eyebrow="Airmanship"
        title="Flying, and the"
        accent="J-hook."
        lede="All of this happens in the Firing Range and none of it happens in a match. Nobody wants to lose an $8,000 loadout because a stranger crashed on takeoff."
      />

      <section className="section">
        <SectionHead
          eyebrow="Syllabus"
          title="Nine drills, in order."
          lede="Each one assumes the one before it. Go to the Firing Range from the bottom-left of the main menu; forward from spawn and two sharp lefts to the vehicle vendor, then Air. Everything there is free."
        />

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
      </section>

      <section className="section">
        <SectionHead
          eyebrow="The combat landing"
          title="The J-hook, one input at a time."
          lede="Coming in slowly nose-up and riding the collective down takes forever, which makes you a stationary target. Done properly a J-hook takes you from 300 km/h to about 70 km/h in one manoeuvre, without gaining altitude. Scrub the track to see which input is live where."
        />
        <Scene name="jhook" />
      </section>

      <section className="section">
        <div className="grid grid-2">
          <Callout label="Why it works" critical>
            <p>
              Banking hard spills the lift vector sideways, so instead of the
              energy going into a climb — which is what happens if you just pull
              the nose up — it goes into the turn. That is the whole trick:{" "}
              <strong>the turn is the airbrake.</strong>
            </p>
          </Callout>

          <article className="card">
            <span className="card-eyebrow">The mistakes</span>
            <ul className="tight">
              {jhookMistakes.map((m, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: m }} />
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <SectionHead eyebrow="Before you trust it" title="The unglamorous version." />
        <div className="prose">
          <p>
            Before you trust a J-hook with six people on board, there is a
            simpler deceleration that works:{" "}
            <strong>
              pitch the nose up and drop the collective all the way down
            </strong>
            , and the aircraft glides toward the zone shedding speed. It has one
            requirement — <strong>start it far out</strong>. Almost every
            recorded mistake is the same one: not pitching up soon enough,
            carrying too much speed into the zone, and having to go around while
            people shoot at you.
          </p>
        </div>

        <Callout label="Low hover">
          <p>
            Once you are near the ground, <strong>make tiny inputs</strong>. Big
            corrections at low speed set up an oscillation — the aircraft rocks
            back and forth, and each correction makes the next one worse. And if
            you start taking fire on short final, land anyway: panicking is what
            turns a hit into a crash.
          </p>
        </Callout>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Where to put it down"
          title="The manoeuvre rarely kills you. The spot does."
        />
        <div className="prose">
          <p>
            Check the map before takeoff and again in the air, follow your
            team&rsquo;s movement, and{" "}
            <strong>land behind where they have just cleared</strong>. Never an
            open field: put the airframe between structures, in a confined space,
            with cover on more than one side. The same technique lands on top of
            towers, which is how squads take FOBs from the roof down.
          </p>
        </div>
      </section>

      <section className="section">
        <SectionHead eyebrow="Survival" title="Not getting shot down." />
        <div className="prose">
          <ul>
            {survival.map((s, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
            ))}
          </ul>
        </div>
      </section>

      <nav className="pager" aria-label="Next">
        <Link className="btn btn-secondary" href="/logistics/">
          Next: logistics
        </Link>
      </nav>
    </>
  );
}
