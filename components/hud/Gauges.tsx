"use client";

import { useEffect, useRef } from "react";
import type { Sim } from "@/lib/sim";

/**
 * Collective, cyclic, pedals — driven straight off the sim ref on a rAF loop
 * and written to the DOM by hand. These move every frame; putting them through
 * React state would re-render the whole HUD sixty times a second to nudge a dot.
 */
export default function Gauges({ sim }: { sim: React.RefObject<Sim> }) {
  const coll = useRef<HTMLDivElement>(null);
  const collN = useRef<HTMLSpanElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const pedL = useRef<HTMLDivElement>(null);
  const pedR = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const f = sim.current?.frame;
      if (f) {
        if (coll.current) coll.current.style.height = `${f.coll * 100}%`;
        if (collN.current) collN.current.textContent = `${Math.round(f.coll * 100)}%`;
        if (stick.current)
          stick.current.style.transform = `translate(${f.cyc[0] * 31}px, ${-f.cyc[1] * 31}px)`;
        if (pedL.current) pedL.current.style.width = `${Math.max(0, -f.ped) * 100}%`;
        if (pedR.current) pedR.current.style.width = `${Math.max(0, f.ped) * 100}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  return (
    <div className="panel gauges">
      <div className="gauge">
        <span className="g-label">Collective</span>
        <div className="coll-track">
          <div ref={coll} className="coll-fill" />
        </div>
        <span ref={collN} className="g-val">56%</span>
      </div>

      <div className="gauge">
        <span className="g-label">Cyclic</span>
        <div className="cyc-box">
          <span className="cyc-cross-h" />
          <span className="cyc-cross-v" />
          <div ref={stick} className="cyc-dot" />
        </div>
      </div>

      <div className="gauge">
        <span className="g-label">Pedals</span>
        <div className="ped-track">
          <div className="ped-half left">
            <div ref={pedL} className="ped-fill" />
          </div>
          <span className="ped-centre" />
          <div className="ped-half right">
            <div ref={pedR} className="ped-fill" />
          </div>
        </div>
        <span className="g-val" style={{ opacity: 0.7 }}>tail rotor</span>
      </div>
    </div>
  );
}
