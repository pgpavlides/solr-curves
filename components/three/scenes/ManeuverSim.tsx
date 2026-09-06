"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import HeliModel from "../HeliModel";
import SceneBoundary from "../SceneBoundary";
import { LUMEN } from "../lumen";
import { maneuvers, type Maneuver } from "@/data/maneuvers";
import { sample, trackPoints, type Sampled } from "@/lib/sample";

// R3F resolves JSX elements against this catalogue. Point it at the WebGPU
// build so <mesh> and friends are the same classes the renderer uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any);

const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ state */
interface Sim {
  t: number;
  playing: boolean;
  speed: number;
  frame: Sampled;
  man: Maneuver;
  /** seconds spent parked at the end of a one-shot maneuver */
  hold: number;
}

/* ------------------------------------------------------------------ ground */
function Ground() {
  const geo = useMemo(() => {
    const half = 90;
    const step = 5;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color(LUMEN.hairline);
    const cs = new THREE.Color(LUMEN.slateRise);
    const push = (x: number, z: number, major: boolean, d: number) => {
      pos.push(x, 0, z);
      const fade = Math.max(0, 1 - d / half);
      const base = major ? cs : c;
      col.push(base.r * fade, base.g * fade, base.b * fade);
    };
    for (let i = -half; i <= half; i += step) {
      const major = i % 25 === 0;
      push(-half, i, major, Math.abs(i));
      push(half, i, major, Math.abs(i));
      push(i, -half, major, Math.abs(i));
      push(i, half, major, Math.abs(i));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </lineSegments>
  );
}

/* ------------------------------------------------------------- shadow blob */
function ShadowBlob({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const rad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rad.addColorStop(0, "rgba(0,0,0,0.75)");
    rad.addColorStop(0.55, "rgba(0,0,0,0.28)");
    rad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame(() => {
    const t = target.current;
    const m = ref.current;
    if (!t || !m) return;
    const h = Math.max(t.position.y, 0);
    m.position.set(t.position.x, 0.02, t.position.z);
    const s = 1 + h * 0.11;
    m.scale.set(s, s, 1);
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.55 - h * 0.028);
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[9, 9]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.5} />
    </mesh>
  );
}

/* -------------------------------------------------------------------- path */
/*
  Built imperatively rather than as JSX: <line> in TSX resolves to the SVG
  element, not THREE.Line, so a <primitive> is the unambiguous way to say it.
*/
const STEPS = 240;

function Track({ man, sim }: { man: Maneuver; sim: React.RefObject<Sim> }) {
  const { plan, flown } = useMemo(() => {
    const pts = trackPoints(man, STEPS);
    const mk = (color: string, opacity: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts.slice(), 3));
      return new THREE.Line(
        g,
        new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })
      );
    };
    return { plan: mk(LUMEN.slateRise, 0.55), flown: mk(LUMEN.lumen, 1) };
  }, [man]);

  useEffect(
    () => () => {
      for (const l of [plan, flown]) {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }
    },
    [plan, flown]
  );

  useFrame(() => {
    const s = sim.current;
    if (!s) return;
    flown.geometry.setDrawRange(0, Math.max(2, Math.round((STEPS + 1) * s.t)));
  });

  return (
    <>
      <primitive object={plan} />
      <primitive object={flown} />
    </>
  );
}

/* ------------------------------------------------------------------ rig */
function Lights() {
  return (
    <>
      <ambientLight intensity={0.75} color={LUMEN.muted} />
      <hemisphereLight intensity={0.8} color={LUMEN.lumen} groundColor={LUMEN.graphite} />
      <directionalLight position={[14, 22, 10]} intensity={2.6} color={LUMEN.muted} />
      <pointLight position={[0, -8, 6]} intensity={90} color={LUMEN.lumen} distance={70} decay={2} />
      <pointLight position={[-18, 6, -18]} intensity={70} color={LUMEN.slateRise} distance={80} decay={2} />
    </>
  );
}

/* ---------------------------------------------------------------- framing */
/*
  Maneuvers range from a 3 m hover to a 126 m transition run. One fixed camera
  cannot serve both, so the view is fitted to each track when it is selected.
*/
function Framing({
  man,
  controls,
  camMode,
}: {
  man: Maneuver;
  controls: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>;
  camMode: "orbit" | "chase";
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (camMode !== "orbit") return;
    const pts = trackPoints(man, 80);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pts.length; i += 3) {
      box.expandByPoint(v.set(pts[i], pts[i + 1], pts[i + 2]));
    }
    const centre = box.getCenter(new THREE.Vector3());
    centre.y = Math.max(centre.y, 3);
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 6);
    const dist = radius * 1.75 + 10;

    camera.position.set(
      centre.x + dist * 0.58,
      centre.y + dist * 0.55,
      centre.z + dist * 0.74
    );
    camera.lookAt(centre);
    const c = controls.current;
    if (c) {
      c.target.copy(centre);
      c.update();
    }
  }, [man, camMode, camera, controls]);

  return null;
}

/* ------------------------------------------------------------- the aircraft */
function Aircraft({
  sim,
  heliRef,
  camMode,
  controls,
}: {
  sim: React.RefObject<Sim>;
  heliRef: React.RefObject<THREE.Group | null>;
  camMode: "orbit" | "chase";
  controls: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>;
}) {
  const { camera } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const s = sim.current;
    const g = heliRef.current;
    if (!s || !g) return;

    if (s.playing) {
      s.t += (dt * s.speed) / s.man.duration;
      if (s.t >= 1) {
        if (s.man.loops) {
          s.t -= 1;
        } else {
          // Hold the finished picture for a beat, then fly it again. A guide
          // that stops on the last frame just looks broken.
          s.t = 1;
          s.hold += dt;
          if (s.hold > 1.5) {
            s.t = 0;
            s.hold = 0;
          }
        }
      } else {
        s.hold = 0;
      }
    }
    const f = sample(s.man, s.t);
    s.frame = f;

    g.position.set(f.pos[0], f.pos[1], f.pos[2]);
    g.rotation.set(f.pitch * DEG, f.hdg * DEG, f.roll * DEG, "YXZ");

    if (camMode === "chase") {
      const back = new THREE.Vector3(0, 4.5, -13).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        f.hdg * DEG
      );
      tmp.copy(g.position).add(back);
      camera.position.lerp(tmp, 1 - Math.pow(0.001, dt));
      camera.lookAt(g.position.x, g.position.y + 1.2, g.position.z);
    }
    // In orbit mode the camera stays put: chasing the aircraft with the
    // target makes the shape of the track impossible to read.
  });

  return (
    <>
      <group ref={heliRef}>
        <HeliModel spin={1} />
      </group>
      {camMode === "orbit" && (
        <OrbitControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={controls as any}
          enablePan={false}
          minDistance={9}
          maxDistance={95}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.06}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ gauges */
function Gauges({ sim }: { sim: React.RefObject<Sim> }) {
  const coll = useRef<HTMLDivElement>(null);
  const collN = useRef<HTMLSpanElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const pedL = useRef<HTMLDivElement>(null);
  const pedR = useRef<HTMLDivElement>(null);
  const ias = useRef<HTMLSpanElement>(null);
  const agl = useRef<HTMLSpanElement>(null);
  const bank = useRef<HTMLSpanElement>(null);
  const pitch = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const f = sim.current?.frame;
      if (f) {
        if (coll.current) coll.current.style.height = `${f.coll * 100}%`;
        if (collN.current) collN.current.textContent = `${Math.round(f.coll * 100)}%`;
        if (stick.current)
          stick.current.style.transform = `translate(${f.cyc[0] * 38}px, ${-f.cyc[1] * 38}px)`;
        if (pedL.current) pedL.current.style.width = `${Math.max(0, -f.ped) * 100}%`;
        if (pedR.current) pedR.current.style.width = `${Math.max(0, f.ped) * 100}%`;
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
    <div className="gauges">
      <div className="gauge gauge-coll">
        <span className="g-label">Collective</span>
        <div className="coll-track">
          <div ref={coll} className="coll-fill" />
        </div>
        <span ref={collN} className="g-val">56%</span>
      </div>

      <div className="gauge gauge-cyc">
        <span className="g-label">Cyclic</span>
        <div className="cyc-box">
          <span className="cyc-cross-h" />
          <span className="cyc-cross-v" />
          <div ref={stick} className="cyc-dot" />
        </div>
        <span className="g-hint">fore/aft = speed · left/right = bank</span>
      </div>

      <div className="gauge gauge-ped">
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
        <span className="g-hint">tail rotor · points the nose</span>
      </div>

      <div className="telemetry">
        <div><span className="k">IAS</span><span className="v"><span ref={ias}>0</span><small>km/h</small></span></div>
        <div><span className="k">AGL</span><span className="v"><span ref={agl}>3.0</span><small>m</small></span></div>
        <div><span className="k">Bank</span><span className="v"><span ref={bank}>0</span><small>°</small></span></div>
        <div><span className="k">Pitch</span><span className="v"><span ref={pitch}>0</span><small>°</small></span></div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- shell */
export default function ManeuverSim() {
  const [manId, setManId] = useState(() => {
    if (typeof window === "undefined") return maneuvers[0].id;
    const q = new URLSearchParams(window.location.search).get("m");
    return maneuvers.some((m) => m.id === q) ? (q as string) : maneuvers[0].id;
  });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [camMode, setCamMode] = useState<"orbit" | "chase">("orbit");
  const [phase, setPhase] = useState(0);
  const [scrub, setScrub] = useState(0);
  const [backend, setBackend] = useState<string>("starting…");

  const man = useMemo(() => maneuvers.find((m) => m.id === manId)!, [manId]);
  const heliRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const sim = useRef<Sim>({
    t: 0,
    playing: true,
    speed: 1,
    man,
    frame: sample(man, 0),
    hold: 0,
  });

  // keep the mutable sim in step with React state
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

  // phase + scrub follow the sim at a readable rate, not every frame
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = sim.current;
      setPhase(s.frame.phase);
      setScrub(s.t);
    }, 90);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="sim">
      <div className="sim-stage">
        <div className="viewport sim-viewport">
          <span className="viewport-label">{man.name}</span>
          <span className="viewport-hint">{backend}</span>
          <div style={{ height: 520 }}>
            <SceneBoundary height={520}>
            <Canvas
              className="viewport-canvas"
              style={{ height: "100%" }}
              camera={{ position: [22, 14, 26], fov: 42, near: 0.1, far: 800 }}
              dpr={[1, 1.75]}
              gl={async (props) => {
                // Probe for WebGPU rather than letting init() discover it the
                // hard way: on machines without it, forcing the WebGL2 backend
                // up front is both faster and far more reliable.
                const hasWebGPU =
                  typeof navigator !== "undefined" && "gpu" in navigator;
                const opts = {
                  ...(props as object),
                  forceWebGL: !hasWebGPU,
                } as ConstructorParameters<typeof THREE.WebGPURenderer>[0];

                let renderer = new THREE.WebGPURenderer(opts);
                try {
                  await renderer.init();
                } catch (err) {
                  if (!hasWebGPU) throw err;
                  console.warn("[wardogspilot] WebGPU init failed, using WebGL2", err);
                  renderer = new THREE.WebGPURenderer({ ...opts, forceWebGL: true });
                  await renderer.init();
                }
                const b = (renderer as unknown as {
                  backend?: { isWebGPUBackend?: boolean };
                }).backend;
                setBackend(b?.isWebGPUBackend ? "WebGPU" : "WebGL2");
                return renderer;
              }}
            >
              <Lights />
              <Ground />
              <Track man={man} sim={sim} />
              <ShadowBlob target={heliRef} />
              <Framing man={man} controls={controlsRef} camMode={camMode} />
              <Aircraft
                sim={sim}
                heliRef={heliRef}
                camMode={camMode}
                controls={controlsRef}
              />
            </Canvas>
            </SceneBoundary>
          </div>

          <div className="viewport-controls sim-transport">
            <button
              className="btn btn-sm"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={playing}
            >
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
        </div>

        <Gauges sim={sim} />
      </div>

      <aside className="sim-side">
        <div className="man-list" role="tablist" aria-label="Maneuvers">
          {maneuvers.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={m.id === manId}
              className={`man-item${m.id === manId ? " is-active" : ""}`}
              onClick={() => {
                setManId(m.id);
                // shareable: /maneuvers/?m=jhook
                window.history.replaceState(null, "", `?m=${m.id}`);
              }}
            >
              <span className="man-name">{m.name}</span>
              <span className="man-tag">{m.tag}</span>
            </button>
          ))}
        </div>

        <p className="man-blurb">{man.blurb}</p>

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

        <div className="callout is-critical">
          <span className="callout-label">Watch for</span>
          <p>{man.watchFor}</p>
        </div>
      </aside>
    </div>
  );
}
