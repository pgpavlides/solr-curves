"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LUMEN } from "./lumen";

/*
  An MH-6 Little Bird built from primitives — no external model, so nothing to
  download and nothing to go stale. Proportions are roughly to scale in metres:
  ~7.5 m rotor diameter, ~2.5 m tall, egg-shaped cabin, thin tail boom.

  Axes: +Y up, +Z is the nose.
*/

const BLADE_COUNT = 5;
const ROTOR_R = 3.75;

export default function LittleBird({
  spin = 1,
  showDisc = true,
}: {
  /** Rotor speed multiplier. 0 parks the blades. */
  spin?: number;
  /** Faint translucent disc that reads as the swept rotor. */
  showDisc?: boolean;
}) {
  const main = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (main.current) main.current.rotation.y += dt * 7.5 * spin;
    if (tail.current) tail.current.rotation.x += dt * 26 * spin;
  });

  return (
    <group>
      {/* ---- cabin: the Little Bird's egg ---- */}
      <mesh castShadow position={[0, 0, 0.15]} scale={[0.86, 0.9, 1.08]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial
          color={LUMEN.shell}
          metalness={0.55}
          roughness={0.42}
        />
      </mesh>

      {/* windscreen — darker, glassier cap on the nose */}
      <mesh position={[0, 0.12, 0.62]} scale={[0.7, 0.62, 0.6]}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial
          color={LUMEN.graphite}
          metalness={0.9}
          roughness={0.12}
        />
      </mesh>

      {/* ---- tail boom ---- */}
      <mesh position={[0, 0.18, -2.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.085, 0.12, 3.4, 16]} />
        <meshStandardMaterial
          color={LUMEN.shell}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* vertical fin */}
      <mesh position={[0, 0.48, -3.85]}>
        <boxGeometry args={[0.05, 0.72, 0.5]} />
        <meshStandardMaterial color={LUMEN.shellDark} metalness={0.5} roughness={0.5} />
      </mesh>
      {/* lower fin */}
      <mesh position={[0, -0.12, -3.9]}>
        <boxGeometry args={[0.05, 0.4, 0.36]} />
        <meshStandardMaterial color={LUMEN.shellDark} metalness={0.5} roughness={0.5} />
      </mesh>
      {/* horizontal stabiliser */}
      <mesh position={[0, 0.26, -3.5]}>
        <boxGeometry args={[1.15, 0.04, 0.34]} />
        <meshStandardMaterial color={LUMEN.shellDark} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* ---- tail rotor ---- */}
      <group ref={tail} position={[0.14, 0.3, -3.98]}>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} rotation={[a, 0, 0]}>
            <boxGeometry args={[0.03, 1.05, 0.11]} />
            <meshStandardMaterial
              color={LUMEN.hairline}
              metalness={0.4}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>

      {/* ---- mast + main rotor ---- */}
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.55, 12]} />
        <meshStandardMaterial color={LUMEN.shellDark} metalness={0.8} roughness={0.3} />
      </mesh>

      <group ref={main} position={[0, 1.42, 0]}>
        <mesh>
          <cylinderGeometry args={[0.19, 0.19, 0.14, 16]} />
          <meshStandardMaterial
            color={LUMEN.slateRise}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        {Array.from({ length: BLADE_COUNT }, (_, i) => {
          const a = (i / BLADE_COUNT) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <mesh position={[ROTOR_R / 2, 0, 0]}>
                <boxGeometry args={[ROTOR_R, 0.025, 0.2]} />
                <meshStandardMaterial
                  color={LUMEN.hairline}
                  metalness={0.35}
                  roughness={0.65}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {showDisc && (
        <mesh position={[0, 1.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[ROTOR_R, 64]} />
          <meshBasicMaterial
            color={LUMEN.lumen}
            transparent
            opacity={0.045}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ---- skids ---- */}
      {[-0.72, 0.72].map((x) => (
        <group key={x}>
          <mesh position={[x, -1.12, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 2.7, 10]} />
            <meshStandardMaterial
              color={LUMEN.hairline}
              metalness={0.6}
              roughness={0.45}
            />
          </mesh>
          {[0.62, -0.72].map((z) => (
            <mesh
              key={z}
              position={[x * 0.72, -0.72, z]}
              rotation={[0, 0, x > 0 ? -0.42 : 0.42]}
            >
              <cylinderGeometry args={[0.038, 0.038, 0.92, 8]} />
              <meshStandardMaterial
                color={LUMEN.hairline}
                metalness={0.6}
                roughness={0.45}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* ---- external benches, the Little Bird's signature ---- */}
      {[-1.02, 1.02].map((x) => (
        <mesh key={x} position={[x, -0.42, 0.05]}>
          <boxGeometry args={[0.52, 0.05, 1.15]} />
          <meshStandardMaterial
            color={LUMEN.shellDark}
            metalness={0.5}
            roughness={0.55}
          />
        </mesh>
      ))}

      {/* Belly horizon: the system's signature line, wrapped onto the airframe */}
      <mesh position={[0, -0.92, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 0.9]} />
        <meshBasicMaterial
          color={LUMEN.lumen}
          transparent
          opacity={0.13}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
