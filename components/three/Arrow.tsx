"use client";

import { useMemo } from "react";
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

/**
 * A vector arrow: shaft plus head, pointed along `dir` from `origin`.
 * Cylinder and cone geometry both point +Y by default, so we rotate the whole
 * group from +Y onto the requested direction once.
 */
export default function Arrow({
  origin = [0, 0, 0],
  dir,
  length,
  color,
  radius = 0.035,
  opacity = 1,
  headLength = 0.34,
}: {
  origin?: [number, number, number];
  dir: [number, number, number];
  length: number;
  color: string;
  radius?: number;
  opacity?: number;
  headLength?: number;
}) {
  const quat = useMemo(() => {
    const d = new THREE.Vector3(...dir).normalize();
    return new THREE.Quaternion().setFromUnitVectors(UP, d);
  }, [dir]);

  if (length <= 0.001) return null;

  const head = Math.min(headLength, length * 0.5);
  const shaft = Math.max(length - head, 0.001);
  const transparent = opacity < 1;

  return (
    <group position={origin} quaternion={quat}>
      <mesh position={[0, shaft / 2, 0]}>
        <cylinderGeometry args={[radius, radius, shaft, 12]} />
        <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0, shaft + head / 2, 0]}>
        <coneGeometry args={[radius * 2.6, head, 14]} />
        <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
    </group>
  );
}
