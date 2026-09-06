"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three/webgpu";
import { LUMEN } from "./lumen";

/*
  The Blender export, wired for animation.

  The GLB comes out of the pipeline with three named nodes:
    HELI_Body       root, 180 deg about Y so the nose lands on +Z, scaled to metres
    HELI_MainRotor  origin on the mast axis, spins about its local Y
    HELI_TailRotor  origin on the tail rotor axis, spins about its local X

  Skids sit exactly at y = 0, so placing the model at world y = 0 puts it on
  the deck with no fudge factor.
*/

const MAIN_RPM = 480; // MD530 is ~480 rpm; scaled down on screen so it reads
const TAIL_RATIO = 5.9;

export default function HeliModel({
  spin = 1,
  blur = true,
}: {
  /** 0 parks the blades, 1 is operating rpm */
  spin?: number;
  /** faint swept disc so the rotor reads at speed instead of strobing */
  blur?: boolean;
}) {
  const { scene } = useGLTF("/heli.glb");
  const root = useMemo(() => scene.clone(true), [scene]);

  const main = useRef<THREE.Object3D | null>(null);
  const tail = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    main.current = root.getObjectByName("HELI_MainRotor") ?? null;
    tail.current = root.getObjectByName("HELI_TailRotor") ?? null;

    // Re-material into the Lumen palette so the aircraft belongs to the page.
    // Material.002 is the canopy glass; everything else is hull.
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const old = mesh.material as THREE.Material | THREE.Material[];
      const name = Array.isArray(old) ? old[0]?.name : old?.name;
      /*
        Metalness is deliberately low. A PBR metal reflects its environment,
        and there is no environment map in this scene — at metalness 0.6+ the
        airframe renders as a black silhouette with no readable form.
      */
      mesh.material = /002/.test(name ?? "")
        ? new THREE.MeshStandardMaterial({
            color: LUMEN.slateRise,
            metalness: 0.3,
            roughness: 0.18,
          })
        : new THREE.MeshStandardMaterial({
            color: LUMEN.shell,
            metalness: 0.18,
            roughness: 0.58,
          });
    });
  }, [root]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05) * spin;
    if (main.current) main.current.rotation.y += step * (MAIN_RPM / 60) * Math.PI * 2 * 0.22;
    if (tail.current) tail.current.rotation.x += step * (MAIN_RPM / 60) * TAIL_RATIO * Math.PI * 2 * 0.06;
  });

  return (
    <group>
      <primitive object={root} />
      {blur && spin > 0.15 && (
        <>
          {/* swept discs: the real blades strobe badly at any frame rate */}
          <mesh position={[0, 2.276, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[4.16, 64]} />
            <meshBasicMaterial
              color={LUMEN.lumen}
              transparent
              opacity={0.035 * spin}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 2.276, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[4.1, 4.17, 64]} />
            <meshBasicMaterial
              color={LUMEN.lumen}
              transparent
              opacity={0.22 * spin}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0.26, 1.465, -4.272]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.78, 32]} />
            <meshBasicMaterial
              color={LUMEN.lumen}
              transparent
              opacity={0.07 * spin}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

useGLTF.preload("/heli.glb");
