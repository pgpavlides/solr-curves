"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Rig from "../Rig";
import Viewport from "../Viewport";
import { CANVAS_DEFAULTS, LUMEN } from "../lumen";

/*
  The J-hook, as a path you can scrub.

  Fly past the LZ fast and low, dump collective, roll toward it and hold yaw so
  the nose stays on the spot through the turn. The track really is a J, which is
  much easier to believe when you can walk along it.
*/

const LZ: [number, number, number] = [0, 0, 0];

/*
  Metres. The run-in is kept short on purpose: at a realistic approach length
  the straight leg swamps the frame and the hook stops reading as a hook. What
  matters here is the shape — past the LZ, then back onto it.
*/
const WAYPOINTS: [number, number, number][] = [
  [-24, 6.4, 13.0],
  [-17, 5.9, 10.6],
  [-11, 5.2, 8.2],
  [-5, 4.4, 6.0],
  [0, 3.7, 3.9],
  [4.5, 3.1, 1.8],
  [8.0, 2.6, -0.6],
  [9.2, 2.1, -3.6],
  [7.2, 1.7, -6.2],
  [3.8, 1.25, -7.2],
  [0.6, 0.85, -5.6],
  [-0.8, 0.4, -2.8],
  [0, 0.06, 0],
];

/** Which input is live, by position along the path. */
const PHASES = [
  { at: 0.0, title: "Arrive fast and low", detail: "As much speed as you can carry, hugging the terrain." },
  { at: 0.34, title: "Collective all the way down", detail: "And hold it down for the whole manoeuvre." },
  { at: 0.5, title: "Roll toward the LZ", detail: "Zone off your left, so roll left." },
  { at: 0.62, title: "Hold yaw into the turn", detail: "Nose stays pointed at the spot the whole way round." },
  { at: 0.78, title: "Tighten the bank and pull", detail: "Trading airspeed against altitude down to a low-energy state." },
  { at: 0.92, title: "Level and cushion", detail: "Collective back up as you settle into the hover." },
];

function phaseAt(t: number) {
  let idx = 0;
  for (let i = 0; i < PHASES.length; i++) if (t >= PHASES[i].at) idx = i;
  return idx;
}

function Track({ t }: { t: number }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        WAYPOINTS.map((p) => new THREE.Vector3(...p)),
        false,
        "catmullrom",
        0.3
      ),
    []
  );

  const points = useMemo(
    () => curve.getPoints(220).map((p) => [p.x, p.y, p.z] as [number, number, number]),
    [curve]
  );

  // The part already flown reads bright; the rest stays as a dim plan line.
  const flownCount = Math.max(2, Math.round(points.length * t));
  const flown = points.slice(0, flownCount);

  const craft = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!craft.current) return;
    const p = curve.getPointAt(Math.min(Math.max(t, 0.0001), 0.9999));
    const tan = curve.getTangentAt(Math.min(Math.max(t, 0.0001), 0.9999));
    craft.current.position.copy(p);

    // Face along track, and bank into the turn by how hard it is curving.
    const look = p.clone().add(tan);
    craft.current.lookAt(look);
    const ahead = curve.getTangentAt(Math.min(t + 0.03, 0.9999));
    const turn = tan.clone().cross(ahead).y;
    craft.current.rotateZ(THREE.MathUtils.clamp(turn * 26, -1.15, 1.15));
  });

  return (
    <>
      {/* The whole J is legible before you touch anything; the flown part
          then burns brighter over the top of it. */}
      <Line points={points} color={LUMEN.slateRise} lineWidth={1.5} />
      {flown.length > 1 && (
        <Line points={flown} color={LUMEN.lumen} lineWidth={2.5} transparent opacity={0.9} />
      )}

      {/* LZ marker */}
      <mesh position={LZ} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.65, 48]} />
        <meshBasicMaterial color={LUMEN.lumen} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 48]} />
        <meshBasicMaterial color={LUMEN.lumen} transparent opacity={0.09} depthWrite={false} />
      </mesh>

      {/* phase markers on the track */}
      {PHASES.map((ph) => {
        const p = curve.getPointAt(Math.min(Math.max(ph.at, 0.0001), 0.9999));
        const live = phaseAt(t) === PHASES.indexOf(ph);
        return (
          <mesh key={ph.at} position={[p.x, p.y, p.z]}>
            <sphereGeometry args={[live ? 0.42 : 0.26, 16, 12]} />
            <meshBasicMaterial
              color={live ? LUMEN.lumen : LUMEN.slateRise}
              transparent
              opacity={live ? 1 : 0.6}
            />
          </mesh>
        );
      })}

      {/* the aircraft, abstracted to a body + rotor disc so it stays readable */}
      <group ref={craft}>
        <mesh scale={[0.55, 0.5, 1.0]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color={LUMEN.shell} metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.05, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 1.9, 10]} />
          <meshStandardMaterial color={LUMEN.shell} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.85, 40]} />
          <meshBasicMaterial
            color={LUMEN.lumen}
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Disc rim, so the aircraft still reads at this camera distance */}
        <mesh position={[0, 0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.8, 1.87, 40]} />
          <meshBasicMaterial
            color={LUMEN.lumen}
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* height line down to the deck, so altitude is readable from any angle */}
      <DropLine curve={curve} t={t} />
    </>
  );
}

function DropLine({ curve, t }: { curve: THREE.CatmullRomCurve3; t: number }) {
  const p = curve.getPointAt(Math.min(Math.max(t, 0.0001), 0.9999));
  return (
    <Line
      points={[
        [p.x, p.y, p.z],
        [p.x, 0, p.z],
      ]}
      color={LUMEN.slateRise}
      lineWidth={1}
      dashed
      dashSize={0.5}
      gapSize={0.4}
    />
  );
}

export default function JHookScene() {
  const [t, setT] = useState(0.42);
  const active = phaseAt(t);

  return (
    <div className="scene-grid">
      <Viewport
        label="J-hook · flight path"
        hint="drag to orbit"
        height={400}
        controls={
          <>
            <label htmlFor="scrub">Along the track</label>
            <input
              id="scrub"
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--color-foreground)",
                minWidth: 46,
                textAlign: "right",
              }}
            >
              {Math.round(t * 100)}%
            </span>
          </>
        }
      >
        <Canvas
          className="viewport-canvas"
          style={{ height: "100%" }}
          camera={{ position: [9, 25, 16], fov: 40 }}
          {...CANVAS_DEFAULTS}
        >
          <Rig intensity={0.85} />
          <Track t={t} />
          <Grid
            args={[120, 120]}
            cellSize={2}
            cellThickness={0.5}
            cellColor={LUMEN.hairline}
            sectionSize={10}
            sectionThickness={0.8}
            sectionColor={LUMEN.slateRise}
            fadeDistance={110}
            fadeStrength={1.2}
            infiniteGrid
          />
          <OrbitControls
            enablePan={false}
            target={[1, 2, -2]}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={14}
            maxDistance={52}
          />
        </Canvas>
      </Viewport>

      <div className="stack-tight">
        <ol className="phases">
          {PHASES.map((ph, i) => (
            <li key={ph.title} className={i === active ? "is-active" : undefined}>
              <div>
                <strong>{ph.title}</strong>
                <br />
                {ph.detail}
              </div>
            </li>
          ))}
        </ol>
        <p className="list-note" style={{ margin: 0 }}>
          Note how little altitude the track gains through the turn. Pulling the
          nose up instead of banking sends that energy straight up, and leaves
          you hanging over the zone.
        </p>
      </div>
    </div>
  );
}
