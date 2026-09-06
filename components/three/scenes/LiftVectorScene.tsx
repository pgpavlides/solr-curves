"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Arrow from "../Arrow";
import Rig from "../Rig";
import Viewport from "../Viewport";
import { CANVAS_DEFAULTS, LUMEN } from "../lumen";

/*
  The lift vector, made literal.

  The rotor makes force in exactly one direction: perpendicular to the disc.
  Bank the disc and that force splits into a vertical component (cos θ, what is
  still holding you up) and a horizontal one (sin θ, what is pulling you round
  the turn). Everything else on the site follows from this, so it is worth
  being able to grab it and tilt it.
*/

const TOTAL = 3.2;
const DISC_R = 1.9;

function Rotor({ bank }: { bank: number }) {
  const rad = (bank * Math.PI) / 180;

  // Bank about the Z axis, so the disc tilts to the pilot's right.
  const vertical = TOTAL * Math.cos(rad);
  const horizontal = TOTAL * Math.sin(rad);

  return (
    <group>
      {/* ---- the disc, tilted ---- */}
      <group rotation={[0, 0, -rad]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[DISC_R, 64]} />
          <meshBasicMaterial
            color={LUMEN.lumen}
            transparent
            opacity={0.07}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[DISC_R - 0.02, DISC_R, 64]} />
          <meshBasicMaterial color={LUMEN.slateRise} side={THREE.DoubleSide} />
        </mesh>

        {/* mast + a token airframe so the disc has something to belong to */}
        <mesh position={[0, -0.42, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.85, 10]} />
          <meshStandardMaterial color={LUMEN.hairline} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, -1.0, 0.1]} scale={[0.46, 0.42, 0.62]}>
          <sphereGeometry args={[1, 24, 18]} />
          <meshStandardMaterial color={LUMEN.shell} metalness={0.55} roughness={0.45} />
        </mesh>

        {/* Total lift — always perpendicular to the disc */}
        <Arrow dir={[0, 1, 0]} length={TOTAL} color={LUMEN.lumen} radius={0.042} />
      </group>

      {/* ---- the two components, in world space ---- */}
      <Arrow
        dir={[0, 1, 0]}
        length={vertical}
        color={LUMEN.foreground}
        radius={0.026}
        opacity={0.85}
      />
      <Arrow
        origin={[0, vertical, 0]}
        dir={[-1, 0, 0]}
        length={Math.abs(horizontal)}
        color={LUMEN.muted}
        radius={0.026}
        opacity={0.85}
      />

      {/* dashed closure of the parallelogram, so the split is legible */}
      {bank > 0.5 && (
        <Line
          points={[
            [0, 0, 0],
            [0, vertical, 0],
            [-horizontal, vertical, 0],
          ]}
          color={LUMEN.hairline}
          lineWidth={1}
          dashed
          dashSize={0.14}
          gapSize={0.1}
        />
      )}

      {/* the altitude you are losing, marked on the mast line */}
      {bank > 4 && (
        <Line
          points={[
            [0.02, vertical, 0],
            [0.02, TOTAL, 0],
          ]}
          color={LUMEN.slateRise}
          lineWidth={2}
        />
      )}
    </group>
  );
}

export default function LiftVectorScene() {
  const [bank, setBank] = useState(30);
  const rad = (bank * Math.PI) / 180;
  const verticalPct = Math.cos(rad) * 100;
  const extraCollective = (1 / Math.cos(rad) - 1) * 100;

  return (
    <div className="scene-grid">
      <Viewport
        label="Rotor disc · lift vector"
        hint="drag to orbit"
        height={400}
        controls={
          <>
            <label htmlFor="bank">Bank</label>
            <input
              id="bank"
              type="range"
              min={0}
              max={60}
              step={1}
              value={bank}
              onChange={(e) => setBank(Number(e.target.value))}
              aria-describedby="bank-readout"
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
              {bank}°
            </span>
          </>
        }
      >
        <Canvas
          className="viewport-canvas"
          style={{ height: "100%" }}
          camera={{ position: [5.0, 2.8, 7.0], fov: 40 }}
          {...CANVAS_DEFAULTS}
        >
          <Rig intensity={0.9} />
          <Rotor bank={bank} />
          <Grid
            position={[0, -1.5, 0]}
            args={[30, 30]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor={LUMEN.hairline}
            sectionSize={2.5}
            sectionThickness={0.8}
            sectionColor={LUMEN.slateRise}
            fadeDistance={22}
            fadeStrength={1.5}
            infiniteGrid
          />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            target={[0, 1.1, 0]}
            minPolarAngle={0.35}
            maxPolarAngle={Math.PI / 2.05}
            autoRotate={false}
          />
        </Canvas>
      </Viewport>

      <div className="stack-tight" id="bank-readout">
        <div className="readout">
          <div className="cell">
            <span className="k">Vertical lift</span>
            <span className="v">
              {verticalPct.toFixed(0)}
              <small>%</small>
            </span>
          </div>
          <div className="cell">
            <span className="k">Collective to hold</span>
            <span className="v">
              +{extraCollective.toFixed(0)}
              <small>%</small>
            </span>
          </div>
        </div>

        <div className="callout is-critical">
          <span className="callout-label">What you are looking at</span>
          <p>
            The <strong>bright arrow</strong> is total lift — it always points
            straight out of the disc, so it tilts when the disc tilts. The{" "}
            <strong>white arrow</strong> is the vertical component still holding
            you up; the <strong>grey arrow</strong> is the horizontal component
            dragging you into the turn.
          </p>
          <p>
            Bank to 45° and you have thrown away <strong>29%</strong> of your
            vertical lift. Bank to 60° and you have thrown away{" "}
            <strong>half</strong> of it. Add collective or raise the nose, or you
            descend — which is exactly what a J-hook exploits on purpose.
          </p>
        </div>
      </div>
    </div>
  );
}
