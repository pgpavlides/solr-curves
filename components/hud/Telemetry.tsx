"use client";

import { useEffect, useRef } from "react";
import type { Sim } from "@/lib/sim";

export default function Telemetry({ sim }: { sim: React.RefObject<Sim> }) {
  const ias = useRef<HTMLSpanElement>(null);
  const agl = useRef<HTMLSpanElement>(null);
  const bank = useRef<HTMLSpanElement>(null);
  const pitch = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const f = sim.current?.frame;
      if (f) {
        if (ias.current) ias.current.textContent = `${Math.round(f.ias)}`;
        if (agl.current) agl.current.textContent = f.pos[1].toFixed(1);
        if (bank.current) bank.current.textContent = `${Math.round(Math.abs(f.roll))}`;
        if (pitch.current) pitch.current.textContent = `${Math.round(f.pitch)}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  return (
    <div className="panel telemetry">
      <div>
        <span className="k">IAS</span>
        <span className="v"><span ref={ias}>0</span><small>km/h</small></span>
      </div>
      <div>
        <span className="k">AGL</span>
        <span className="v"><span ref={agl}>3.0</span><small>m</small></span>
      </div>
      <div>
        <span className="k">Bank</span>
        <span className="v"><span ref={bank}>0</span><small>°</small></span>
      </div>
      <div>
        <span className="k">Pitch</span>
        <span className="v"><span ref={pitch}>0</span><small>°</small></span>
      </div>
    </div>
  );
}
