"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Rig from "../Rig";
import Viewport from "../Viewport";
import { CANVAS_DEFAULTS, LUMEN } from "../lumen";

/*
  Drop height, to scale, against a 1.8 m soldier.

  "Five metres" is an abstraction until you see it next to a person. Severity is
  luminance only, per DESIGN.md: the safe band burns Lumen-bright, the fatal one
  falls away to hairline.
*/

const BANDS = [
  { agl: 5, label: "Safe", note: "No damage. Everybody walks away.", tone: LUMEN.lumen },
  { agl: 7, label: "Marginal", note: "They start taking fall damage.", tone: LUMEN.slateRise },
  { agl: 8, label: "Bad", note: "≈40 HP left. Dropped into a fight, they die.", tone: LUMEN.slateRise },
  { agl: 10, label: "Fatal", note: "Death. You killed your own squad and your payout.", tone: LUMEN.hairline },
];

function outcomeFor(h: number) {
  if (h <= 5) return BANDS[0];
  if (h < 8) return BANDS[1];
  if (h < 9) return BANDS[2];
  return BANDS[3];
}

/*
  The 1.8 m reference figure. It is the entire reason the scene works, so it is
  lit brighter than the airframe rather than darker — a scale reference you
  cannot see is not a scale reference.
*/
function Soldier() {
  return (
    <group position={[1.5, 0, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <capsuleGeometry args={[0.16, 0.5, 6, 12]} />
        <meshStandardMaterial color={LUMEN.slateRise} metalness={0.1} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <capsuleGeometry args={[0.22, 0.5, 6, 12]} />
        <meshStandardMaterial color={LUMEN.muted} metalness={0.15} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshStandardMaterial color={LUMEN.lumen} metalness={0.2} roughness={0.7} />
      </mesh>
      {/* height tick, so the 1.8 m is stated and not just implied */}
      <Line
        points={[
          [0.42, 0, 0],
          [0.42, 1.83, 0],
        ]}
        color={LUMEN.muted}
        lineWidth={1}
      />
    </group>
  );
}

function Scene({ height }: { height: number }) {
  return (
    <group>
      {/* band markers, drawn to scale across the deck */}
      {BANDS.map((b) => (
        <group key={b.agl}>
          <Line
            points={[
              [-2.6, b.agl, 0],
              [2.6, b.agl, 0],
            ]}
            color={b.tone}
            lineWidth={b.agl === 5 ? 2 : 1}
            dashed={b.agl !== 5}
            dashSize={0.22}
            gapSize={0.18}
          />
        </group>
      ))}

      {/* the aircraft, at the chosen AGL */}
      <group position={[-0.6, height, 0]}>
        <mesh scale={[0.62, 0.55, 0.85]}>
          <sphereGeometry args={[1, 22, 16]} />
          <meshStandardMaterial color={LUMEN.shell} metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.9, 44]} />
          <meshBasicMaterial
            color={LUMEN.lumen}
            transparent
            opacity={0.13}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* skids */}
        {[-0.42, 0.42].map((x) => (
          <mesh key={x} position={[x, -0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.5, 8]} />
            <meshStandardMaterial color={LUMEN.hairline} metalness={0.6} roughness={0.45} />
          </mesh>
        ))}
      </group>

      {/* the fall itself */}
      <Line
        points={[
          [-0.6, height - 0.62, 0],
          [-0.6, 0, 0],
        ]}
        color={outcomeFor(height).tone}
        lineWidth={2}
      />

      <Soldier />

      {/* deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color={LUMEN.graphite} metalness={0.2} roughness={0.95} />
      </mesh>
    </group>
  );
}

export default function DropScene() {
  const [height, setHeight] = useState(5);
  const outcome = outcomeFor(height);

  return (
    <div className="scene-grid">
      <Viewport
        label="Drop height · to scale"
        hint="1.8 m soldier"
        height={400}
        controls={
          <>
            <label htmlFor="agl">Height AGL</label>
            <input
              id="agl"
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--color-foreground)",
                minWidth: 52,
                textAlign: "right",
              }}
            >
              {height.toFixed(1)} m
            </span>
          </>
        }
      >
        <Canvas
          className="viewport-canvas"
          style={{ height: "100%" }}
          camera={{ position: [8.5, 8.0, 11.5], fov: 42 }}
          {...CANVAS_DEFAULTS}
        >
          <Rig intensity={0.9} />
          <Scene height={height} />
          <Grid
            args={[60, 60]}
            cellSize={1}
            cellThickness={0.5}
            cellColor={LUMEN.hairline}
            sectionSize={5}
            sectionThickness={0.8}
            sectionColor={LUMEN.slateRise}
            fadeDistance={44}
            fadeStrength={1.4}
            infiniteGrid
          />
          <OrbitControls
            enablePan={false}
            target={[0, 5.2, 0]}
            minPolarAngle={0.3}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={10}
            maxDistance={30}
          />
        </Canvas>
      </Viewport>

      <div className="stack-tight">
        <div className="readout">
          <div className="cell">
            <span className="k">At this height</span>
            <span className="v">{outcome.label}</span>
          </div>
          <div className="cell">
            <span className="k">Times the soldier</span>
            <span className="v">
              {(height / 1.8).toFixed(1)}
              <small>×</small>
            </span>
          </div>
        </div>

        <div className={`callout${height <= 5 ? " is-critical" : ""}`}>
          <span className="callout-label">{outcome.label}</span>
          <p>{outcome.note}</p>
          <p>
            Read <strong>AGL</strong> off the HUD before you tell anyone to jump —
            not ASL, which is height above sea level and changes with the terrain
            under you. The gap between &ldquo;fine&rdquo; and &ldquo;dead&rdquo;
            is about <strong>four metres</strong>, which is roughly two of the
            figure standing beside the aircraft.
          </p>
        </div>
      </div>
    </div>
  );
}
