"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three/webgpu";
import { LUMEN } from "./lumen";

/*
  The Blender export, wired for animation.

  The GLB carries three named nodes:
    HELI_Body       root, 180 deg about Y so the nose lands on +Z, scaled to metres
    HELI_MainRotor  origin on the mast axis, spins about its local Y
    HELI_TailRotor  origin on the tail rotor axis, spins about its local X

  Skids sit exactly at y = 0, so placing the model at world y = 0 puts it on
  the deck with no fudge factor.
*/

/** Main rotor, revolutions per second on screen. Slower than the real ~480 rpm
 *  so the blades read as blades instead of strobing into a solid ring. */
const MAIN_REV_PER_SEC = 1.75;
/** MD530 tail rotor turns about 5.9 times for every main rotor turn. Both
 *  rotors derive from the one figure above so the ratio cannot drift: using
 *  separate fudge factors is what previously had the tail turning at 1.6:1. */
const TAIL_RATIO = 5.9;
const TAU = Math.PI * 2;

type Axis = "x" | "y";

/** Largest distance any vertex sits from the given spin axis, in node units. */
function discRadius(node: THREE.Object3D, axis: Axis): number {
  let r2 = 0;
  node.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    const pos = g?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const d = axis === "y" ? x * x + z * z : y * y + z * z;
      if (d > r2) r2 = d;
    }
  });
  return Math.sqrt(r2);
}

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
  const discMats = useRef<{ mat: THREE.MeshBasicMaterial; base: number }[]>([]);

  useEffect(() => {
    main.current = root.getObjectByName("HELI_MainRotor") ?? null;
    tail.current = root.getObjectByName("HELI_TailRotor") ?? null;

    /*
      Re-material into the Lumen palette. Metalness is deliberately low: there
      is no environment map in this scene, and a PBR metal with nothing to
      reflect renders as a black silhouette. Material.002 is the canopy glass.
    */
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const old = mesh.material as THREE.Material | THREE.Material[];
      const name = Array.isArray(old) ? old[0]?.name : old?.name;
      mesh.material = /002/.test(name ?? "")
        ? new THREE.MeshStandardMaterial({ color: LUMEN.slateRise, metalness: 0.3, roughness: 0.18 })
        : new THREE.MeshStandardMaterial({ color: LUMEN.shell, metalness: 0.18, roughness: 0.58 });
    });

    /*
      Swept discs are added as CHILDREN of the rotor nodes rather than placed
      at hand-computed coordinates. Parenting means they inherit the hub
      position and the model scale automatically — the previous hardcoded
      positions were still those of an older export scale, leaving the tail
      disc a third of a metre ahead of its own rotor.
    */
    const added: THREE.Mesh[] = [];
    discMats.current = [];

    const attach = (node: THREE.Object3D | null, axis: Axis, opacity: number, rim: boolean) => {
      if (!node) return;
      const r = discRadius(node, axis);
      if (!(r > 0)) return;

      const make = (geo: THREE.BufferGeometry, base: number) => {
        const mat = new THREE.MeshBasicMaterial({
          color: LUMEN.lumen,
          transparent: true,
          opacity: base,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        // circleGeometry faces +Z; turn it to face the spin axis
        if (axis === "y") mesh.rotation.x = -Math.PI / 2;
        else mesh.rotation.y = Math.PI / 2;
        mesh.renderOrder = 2;
        node.add(mesh);
        added.push(mesh);
        discMats.current.push({ mat, base });
      };

      make(new THREE.CircleGeometry(r, 64), opacity);
      if (rim) make(new THREE.RingGeometry(r * 0.985, r, 64), opacity * 6);
    };

    if (blur) {
      attach(main.current, "y", 0.035, true);
      attach(tail.current, "x", 0.09, false);
    }

    return () => {
      for (const m of added) {
        m.removeFromParent();
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      discMats.current = [];
    };
  }, [root, blur]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05) * spin;
    if (main.current) main.current.rotation.y += step * MAIN_REV_PER_SEC * TAU;
    if (tail.current) tail.current.rotation.x += step * MAIN_REV_PER_SEC * TAIL_RATIO * TAU;
    // the swept discs only read once the blades are actually moving
    const k = Math.min(Math.max((spin - 0.12) / 0.5, 0), 1);
    for (const d of discMats.current) d.mat.opacity = d.base * k;
  });

  return <primitive object={root} />;
}

useGLTF.preload("/heli.glb");
