"use client";

import { LUMEN } from "./lumen";

/**
 * The system's lighting signature: bottom-lit. A cool Lumen key spills up from
 * beneath the subject, a dim fill sits above so the topsides don't go black,
 * and a rim behind separates the silhouette from the ground.
 */
export default function Rig({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <ambientLight intensity={0.55 * intensity} color={LUMEN.muted} />
      {/* Sky/ground bounce, so unlit faces keep some form instead of going flat */}
      <hemisphereLight
        intensity={0.7 * intensity}
        color={LUMEN.lumen}
        groundColor={LUMEN.graphite}
      />
      {/* Key, from below — the whole point of the system */}
      <pointLight
        position={[0, -4, 2]}
        intensity={45 * intensity}
        color={LUMEN.lumen}
        distance={26}
        decay={2}
      />
      {/* Fill from above */}
      <directionalLight
        position={[3, 8, 4]}
        intensity={1.5 * intensity}
        color={LUMEN.muted}
      />
      {/* Rim, behind and low */}
      <pointLight
        position={[-6, 1.5, -7]}
        intensity={30 * intensity}
        color={LUMEN.slateRise}
        distance={30}
        decay={2}
      />
    </>
  );
}
