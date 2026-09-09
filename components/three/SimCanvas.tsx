"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import HeliModel from "./HeliModel";
import { LUMEN } from "./lumen";
import type { Maneuver } from "@/data/maneuvers";
import { sample, trackPoints } from "@/lib/sample";
import type { CamMode, Sim } from "@/lib/sim";

// R3F resolves JSX elements against this catalogue. Point it at the WebGPU
// build so <mesh> and friends are the same classes the renderer uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any);

const DEG = Math.PI / 180;
const STEPS = 240;

type ControlsRef = React.RefObject<{ target: THREE.Vector3; update: () => void } | null>;

/* ------------------------------------------------------------------ ground */
function Ground() {
  const geo = useMemo(() => {
    const half = 120;
    const step = 5;
    const pos: number[] = [];
    const col: number[] = [];
    const minor = new THREE.Color(LUMEN.hairline);
    const major = new THREE.Color(LUMEN.slateRise);
    const push = (x: number, z: number, isMajor: boolean, d: number) => {
      pos.push(x, 0, z);
      const fade = Math.max(0, 1 - d / half) ** 1.4;
      const c = isMajor ? major : minor;
      col.push(c.r * fade, c.g * fade, c.b * fade);
    };
    for (let i = -half; i <= half; i += step) {
      const isMajor = i % 25 === 0;
      push(-half, i, isMajor, Math.abs(i));
      push(half, i, isMajor, Math.abs(i));
      push(i, -half, isMajor, Math.abs(i));
      push(i, half, isMajor, Math.abs(i));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, []);

  useEffect(() => () => geo.dispose(), [geo]);

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

  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(() => {
    const t = target.current;
    const m = ref.current;
    if (!t || !m) return;
    const h = Math.max(t.position.y, 0);
    m.position.set(t.position.x, 0.02, t.position.z);
    const s = 1 + h * 0.11;
    m.scale.set(s, s, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - h * 0.028);
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
    return { plan: mk(LUMEN.slateRise, 0.7), flown: mk(LUMEN.lumen, 1) };
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

/* ------------------------------------------------------------------- lights */
function Lights() {
  return (
    <>
      {/* see the note in lumen.ts: lamps take the light tokens, never the palette */}
      <ambientLight intensity={1.15} color={LUMEN.lightFill} />
      <hemisphereLight intensity={1.1} color={LUMEN.lightKey} groundColor={LUMEN.lightBounce} />
      <directionalLight position={[14, 22, 10]} intensity={2.2} color={LUMEN.lightKey} />
      <pointLight position={[0, -8, 6]} intensity={55} color={LUMEN.lightBounce} distance={70} decay={2} />
      <pointLight position={[-18, 6, -18]} intensity={45} color={LUMEN.lightFill} distance={80} decay={2} />
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
  controls: ControlsRef;
  camMode: CamMode;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (camMode !== "orbit") return;
    const pts = trackPoints(man, 80);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pts.length; i += 3) box.expandByPoint(v.set(pts[i], pts[i + 1], pts[i + 2]));
    const centre = box.getCenter(new THREE.Vector3());
    centre.y = Math.max(centre.y, 3);
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 6);
    const dist = radius * 2.05 + 12;

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
}: {
  sim: React.RefObject<Sim>;
  heliRef: React.RefObject<THREE.Group | null>;
  camMode: CamMode;
}) {
  const { camera } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const back = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

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
      back.set(0, 4.5, -13).applyAxisAngle(up, f.hdg * DEG);
      tmp.copy(g.position).add(back);
      camera.position.lerp(tmp, 1 - Math.pow(0.001, dt));
      camera.lookAt(g.position.x, g.position.y + 1.2, g.position.z);
    }
    // In orbit mode the camera stays put: chasing the aircraft with the
    // target makes the shape of the track impossible to read.
  });

  return (
    <group ref={heliRef}>
      <HeliModel spin={1} />
    </group>
  );
}

/* Renders only once its Suspense siblings have resolved, i.e. once the GLB is
   actually parsed and in the scene. */
function Loaded({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => onLoaded(), [onLoaded]);
  return null;
}

/* -------------------------------------------------------------------- shell */
export default function SimCanvas({
  man,
  sim,
  camMode,
  onReady,
  onModelReady,
}: {
  man: Maneuver;
  sim: React.RefObject<Sim>;
  camMode: CamMode;
  onReady: (backend: string) => void;
  onModelReady: () => void;
}) {
  const heliRef = useRef<THREE.Group | null>(null);
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);

  return (
    <Canvas
      camera={{ position: [22, 18, 26], fov: 42, near: 0.1, far: 1200 }}
      dpr={[1, 1.75]}
      gl={async (props) => {
        // Probe for WebGPU rather than letting init() discover it the hard
        // way: on machines without it, forcing the WebGL2 backend up front is
        // both faster and far more reliable.
        const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
        const opts = {
          ...(props as object),
          forceWebGL: !hasWebGPU,
          antialias: true,
        } as ConstructorParameters<typeof THREE.WebGPURenderer>[0];

        let renderer = new THREE.WebGPURenderer(opts);
        try {
          await renderer.init();
        } catch (err) {
          if (!hasWebGPU) throw err;
          console.warn("[broccolipilot] WebGPU init failed, using WebGL2", err);
          renderer = new THREE.WebGPURenderer({ ...opts, forceWebGL: true });
          await renderer.init();
        }
        const b = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
        onReady(b?.isWebGPUBackend ? "WebGPU" : "WebGL2");
        return renderer;
      }}
    >
      <Lights />
      <Ground />
      <Track man={man} sim={sim} />
      <ShadowBlob target={heliRef} />
      <Framing man={man} controls={controls} camMode={camMode} />
      <Suspense fallback={null}>
        <Aircraft sim={sim} heliRef={heliRef} camMode={camMode} />
        <Loaded onLoaded={onModelReady} />
      </Suspense>
      {camMode === "orbit" && (
        <OrbitControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={controls as any}
          enablePan={false}
          minDistance={9}
          maxDistance={180}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.06}
        />
      )}
    </Canvas>
  );
}
