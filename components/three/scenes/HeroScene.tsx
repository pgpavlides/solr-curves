"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Grid } from "@react-three/drei";
import * as THREE from "three";
import LittleBird from "../LittleBird";
import Rig from "../Rig";
import Viewport from "../Viewport";
import { CANVAS_DEFAULTS, LUMEN } from "../lumen";

/** Slow yaw plus a shallow bob, so it reads as hovering rather than spinning. */
function Hover() {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime;
    g.current.rotation.y = t * 0.16;
    g.current.position.y = Math.sin(t * 0.7) * 0.09;
    g.current.rotation.z = Math.sin(t * 0.5) * 0.018;
    g.current.rotation.x = Math.sin(t * 0.42 + 1) * 0.014;
  });
  return (
    <group ref={g}>
      <LittleBird />
    </group>
  );
}

export default function HeroScene() {
  return (
    <Viewport label="MH-6 Little Bird" hint="7.5 m rotor">
      <Canvas
        className="viewport-canvas"
        style={{ height: "100%" }}
        camera={{ position: [6.4, 2.6, 7.2], fov: 38 }}
        {...CANVAS_DEFAULTS}
      >
        <Rig />
        <Hover />

        <Grid
          position={[0, -1.55, 0]}
          args={[40, 40]}
          cellSize={1}
          cellThickness={0.5}
          cellColor={LUMEN.hairline}
          sectionSize={5}
          sectionThickness={0.8}
          sectionColor={LUMEN.slateRise}
          fadeDistance={26}
          fadeStrength={1.6}
          infiniteGrid
        />

        <ContactShadows
          position={[0, -1.53, 0]}
          opacity={0.5}
          scale={18}
          blur={2.4}
          far={5}
          color="#000000"
        />
      </Canvas>
    </Viewport>
  );
}
