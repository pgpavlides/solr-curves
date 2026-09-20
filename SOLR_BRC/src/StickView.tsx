import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PadLike } from "./gamepad";
import { KNOB, PADS, SOLR_LED_MAP, type VoiceConfig } from "./voice";

/*
  The stick itself, in 3D: public/solr.glb (the grip, Handle_SolR.xaml) on
  public/solr_base.glb (the base, Falcon_Base.xaml) - both converted by
  tools/solr_model.py from the models T.A.R.G.E.T. ships, as its own device
  file pairs them. Every button is a named part, so a press lights it up here
  exactly as on the desk.

  Pads also wear their bank colour, the same rule as the real LEDs: a pad with
  no sound in this bank stays dark.
*/

interface Props {
  stick: PadLike | null;
  /** the bank being shown (not necessarily the knob's) */
  bank: number | null;
  cfg: VoiceConfig;
  /** the button being edited, ringed in white */
  selected?: number | null;
  onSelect?: (button: number | null) => void;
}

/*
  Part name -> the button number Windows reports. The device file
  (VID_044F&PID_0422.dev) lists 44 buttons: B1-B23 are the base's own
  (SOL_B1..) and B24-B44 the grip's (SOL_SG24..), which is exactly the base
  model's btn1..btn23 and the grip model's btn_1..btn_21.
*/
const GRIP_FIRST = 23;
const partNumber = (name: string): number | null => {
  const base = /^base:btn(\d+)$/i.exec(name);
  if (base) return Number(base[1]);
  const grip = /^btn_(\d+)$/i.exec(name);
  return grip ? Number(grip[1]) + GRIP_FIRST : null;
};

/*
  T.A.R.G.E.T. draws blue arrows over the model to show which way each axis
  moves. They are the parts wearing its "axes" material, so that is how we
  find them - the hat's four arrows included. Off unless asked for, except
  the hat arrow of a hat that is being pushed.
*/

const HAT_PART = ["HAT_UP", "HAT_RIGHT", "HAT_DOWN", "HAT_LEFT"];
/** a button under the pointer, or under your thumb */
const HOT = "#ffd23f";

/** Where the grip sits on the base: the two models have their own origins,
    and this is where the grip's skirt meets the socket. Found by eye on the
    model itself. */
const FIT = { x: 0.1, y: 11.9, z: -0.8 };

export default function StickView({ stick, bank, cfg, selected = null, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const parts = useRef<Map<string, THREE.Mesh[]>>(new Map());
  /*
    Some buttons are hidden under their own cap: the base's pads are thin
    plates (btn5, btn16...) with a separate moulded top over them, so a click
    or a hover lands on the cap and finds nothing. Any small part sitting on a
    button counts as that button.
  */
  const partOf = useRef<Map<string, number>>(new Map());
  const arrowParts = useRef<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [arrows, setArrows] = useState(false);
  const arrowsRef = useRef(arrows);
  arrowsRef.current = arrows;

  const live = useRef({ stick, bank, cfg, selected, hovered });
  live.current = { stick, bank, cfg, selected, hovered };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f1412");
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(6, 10, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88bbff, 1.1);
    rim.position.set(-8, 2, -6);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let picked: string | null = null;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const loader = new GLTFLoader();
    const load = (url: string, prefix: string) =>
      new Promise<THREE.Group>((res, rej) => loader.load(url, (g) => {
        g.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = (mesh.material as THREE.Material).clone();
          // keep the model's own colour: highlights paint over it and back
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.userData.own = mat.color?.clone();
          const name = prefix + (mesh.parent?.name || mesh.name).trim();
          // the ray gives back a mesh, not a name: keep the part's name on it,
          // prefix and all, or the base's parts are looked up as the grip's
          mesh.userData.part = name;
          if ((mesh.material as THREE.Material).name === "axes") arrowParts.current.add(name);
          const list = parts.current.get(name) ?? [];
          list.push(mesh);
          parts.current.set(name, list);
        });
        res(g.scene);
      }, undefined, rej));

    const whole = new THREE.Group();
    Promise.all([load("/solr_base.glb", "base:"), load("/solr.glb", "")])
      .then(([base, grip]) => {
        grip.position.set(FIT.x, FIT.y, FIT.z);
        whole.add(base, grip);
        const box = new THREE.Box3().setFromObject(whole);
        const size = box.getSize(new THREE.Vector3());
        whole.position.sub(box.getCenter(new THREE.Vector3()));

        // caps and covers -> the button underneath
        const boxes = new Map<string, THREE.Box3>();
        for (const [name, meshes] of parts.current) {
          const bb = new THREE.Box3();
          for (const m of meshes) bb.union(new THREE.Box3().setFromObject(m));
          boxes.set(name, bb);
          const n = partNumber(name);
          if (n !== null) partOf.current.set(name, n);
        }
        const mid = new THREE.Vector3();
        for (const [name, bb] of boxes) {
          if (partOf.current.has(name) || arrowParts.current.has(name)) continue;
          if (bb.getSize(new THREE.Vector3()).length() > 4) continue; // shells and plates stay themselves
          bb.getCenter(mid);
          for (const [other, ob] of boxes) {
            const n = partOf.current.get(other);
            if (n === undefined) continue;
            if (ob.clone().expandByScalar(0.35).containsPoint(mid)) {
              partOf.current.set(name, n);
              break;
            }
          }
        }
        scene.add(whole);
        const reach = Math.max(size.x, size.y, size.z);
        camera.position.set(reach * 0.75, reach * 0.45, reach * 1.35);
        controls.minDistance = reach * 0.5;
        controls.maxDistance = reach * 4;
        controls.update();
        setLoading(false);
      })
      .catch((e) => setError(`Couldn't load the stick model: ${e}`));

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    el.addEventListener("pointermove", move);
    const click = () => {
      // clicking the background keeps the button you had: only a button changes it
      const n = picked ? partOf.current.get(picked) ?? null : null;
      if (n !== null) onSelect?.(n);
    };
    el.addEventListener("click", click);

    let raf = 0;
    const colour = new THREE.Color();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { stick: s, bank: b, cfg: c, selected: sel, hovered: hov } = live.current;
      // the knob keeps one of 20-23 held: it would sit there lit for ever
      const down = new Set((s?.buttons ?? []).flatMap((x, i) => (x.pressed && !KNOB.includes(i + 1) ? [i + 1] : [])));
      const hat = s?.hat ?? -1;

      for (const [name, meshes] of parts.current) {
        const hatOn = hat >= 0 && HAT_PART[hat] === name;
        if (arrowParts.current.has(name)) {
          for (const m of meshes) {
            m.visible = arrowsRef.current || hatOn;
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.emissive = colour.set(hatOn ? "#ffffff" : "#000000");
            mat.emissiveIntensity = hatOn ? 1 : 0;
          }
          continue;
        }
        const btn = partOf.current.get(name) ?? null;
        const pressed = btn !== null && down.has(btn);
        const isSelected = btn !== null && btn === sel;
        // the one you clicked stays yellow until you click another
        const hot = pressed || isSelected || (btn !== null && name === hov);
        for (const m of meshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          // a button turns yellow under the pointer and under your thumb - the
          // paint changes, not just the glow, so it reads on the dark plastic
          mat.color?.copy(hot ? colour.set(HOT) : (mat.userData.own ?? colour.set("#888888")));
          if (pressed) {
            mat.emissive = colour.set(HOT);
            mat.emissiveIntensity = 1.4;
          } else if (isSelected) {
            mat.emissive = colour.set(HOT);
            mat.emissiveIntensity = 1;
          } else if (btn !== null && name === hov) {
            mat.emissive = colour.set(HOT);
            mat.emissiveIntensity = 0.7;
          } else {
            mat.emissiveIntensity = 0;
          }
        }
      }

      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(scene.children, true)[0];
      const name = hit ? (hit.object.userData.part as string | undefined) ?? null : null;
      if (name !== picked) {
        picked = name;
        setHovered(name);
        el.style.cursor = name && partOf.current.has(name) ? "pointer" : "default";
      }
      controls.update();
      renderer.render(scene, camera);
    };
    resize();
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("click", click);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      parts.current.clear();
      partOf.current.clear();
      arrowParts.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the knob (20-23) holds one of its buttons the whole time: that isn't a press
  const pressed = (stick?.buttons ?? []).flatMap((b, i) => (b.pressed && !KNOB.includes(i + 1) ? [i + 1] : []));
  const hoveredButton = hovered ? partOf.current.get(hovered) ?? null : null;

  return (
    <div className="stick-view">
      <div className="sv-canvas" ref={host}>
        {loading && !error && <div className="sv-note">Loading the stick...</div>}
        {error && <div className="sv-note warn">{error}</div>}
      </div>
      <div className="sv-bar">
        <span className="muted">Drag to turn · wheel to zoom · click a button to edit it</span>
        <label className="sv-arrows" title="T.A.R.G.E.T.'s own blue arrows showing which way each axis moves">
          <input type="checkbox" checked={arrows} onChange={(e) => setArrows(e.target.checked)} /> axis arrows
        </label>
        <span>
          Pressed: <b>{pressed.length ? pressed.join(", ") : "nothing"}</b>
        </span>
        {hoveredButton !== null && (
          <span className="muted">
            Button <b>{hoveredButton}</b>
            {PADS.includes(hoveredButton) && ` · LED ${cfg.map[hoveredButton] ?? SOLR_LED_MAP[hoveredButton]}`}
          </span>
        )}
      </div>
    </div>
  );
}
