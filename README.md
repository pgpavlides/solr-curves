# wardogspilot.com

A WARDOGS helicopter flight guide, built out of the community's own videos with
every author credited. The front door is four doors; behind one of them the site
becomes a full-screen simulator.

## Shape

```
app/page.tsx            the front door — 2x2 grid of the four sections
app/simulator/          the application: <App/> plus a <noscript> summary
app/guides/             written write-ups, index + one route per guide
app/youtubers/          the credit page: every creator and every video
app/pilot-app/          status page for the desktop companion
app/terminology/        the words, defined

components/App.tsx      HUD state, keyboard, deep links, loader gate
components/three/       the full-viewport WebGPU canvas and the airframe
components/hud/         gauges, telemetry, reference drawer
components/DocShell.tsx chrome shared by every reading page
```

Only `/simulator/` is an application; everything else is a document. That split
is why the GLB preload and the `maximumScale: 1` viewport lock both live on that
route's `page.tsx` rather than in the root layout — a 1.9 MB model and a
pinch-zoom lock have no business on a page of prose.

The HUD is a CSS grid pinned over the canvas with `pointer-events: none`,
re-enabled per panel — brand top-left, actions top-right, maneuver rail left,
brief right, gauges/transport/telemetry along the bottom. The simulator is
locked to the viewport by `#app { position: fixed }` rather than by nailing down
`html, body`, so the reading pages can still scroll.

Keyboard: **Space** play/pause, **R** reference. Deep links: `/simulator/?m=jhook`.

## Stack

- **Next.js 15**, App Router, **static export** (`output: "export"` → `out/`).
- **React 19**, TypeScript strict.
- **React Three Fiber 9** + **drei 10** + **three 0.180** for the scenes.
- **Lumen Edge** design system — plain CSS, vendored at `styles/system.css`.
- No CSS framework, no state library.

## Design system wiring

The system enters the app in exactly one place:

```
styles/system.css      the vendored design system (do not edit)
      ↑ @import
styles/globals.css     site-level scaffolding built only from system tokens
      ↑ import
app/layout.tsx         the single import for the whole app
```

The build emits **one** CSS bundle shared by every route. Nothing else may
import either file.

`DESIGN.md` (the system's own spec) and `DESIGN-LICENSE.md` are kept in the repo
root for reference.

### House rules inherited from DESIGN.md

- **No chromatic accents.** State is luminance, never hue. Table severity is a
  leading rule running Lumen → Slate Rise → Hairline in brightness; the 3D
  scenes use the same ramp.
- **The horizon line carries interaction.** Hover, focus and "read this"
  brighten the 70%-wide bottom highlight rather than shifting colour.
- **Everything is lit from below.** `components/three/Rig.tsx` is the scene
  equivalent of `--surface-gradient`: a cool Lumen key underneath, dim fill
  above, slate rim behind.
- **Radius vocabulary:** 7px controls, 14px cards, panels and viewports.
- **Type:** Space Grotesk display, Inter body, JetBrains Mono for anything
  numeric or technical.
- **Icons:** Lucide only, stroke-width 1.5, inlined in `components/Icon.tsx`.

## The 3D scenes

WebGL cannot run during a static export, so every scene is pulled in
client-side only through `components/three/Scene.tsx`, which is a client
component doing `dynamic(..., { ssr: false })`. That keeps three.js out of the
initial bundle — pages with a scene cost ~1.5 kB more up front, and the
~700 kB three chunk loads on demand.

`SimCanvas.tsx` is the whole scene: ground grid, flight path, shadow blob, the
airframe and the camera. `HeliModel.tsx` loads `public/heli.glb`.

The earlier multi-page build had four small diagram scenes (lift vector, J-hook
path, drop-height scale, hero). They were removed when the site became one
application; they are in git history if any are wanted back as a HUD overlay.

### WebGPU

The scene uses `three/webgpu`. drei's `Grid`, `Line` and `ContactShadows` are
GLSL `ShaderMaterial`s that the WebGPU renderer will not compile, so the grid,
the flight path and the ground shadow are all built from `LineBasicMaterial`,
`Float32BufferAttribute` vertex colours and a `CanvasTexture` instead.

The renderer probes `navigator.gpu` and forces the WebGL2 backend when it is
absent rather than letting `init()` fail; the viewport badge reports which
backend actually came up. `SceneBoundary` turns any scene crash into a readable
message instead of a blank rectangle.

Materials are set at **low metalness on purpose**. There is no environment map
in these scenes, and a PBR metal with nothing to reflect renders as a black
silhouette.

## The Blender pipeline

`public/heli.glb` came out of a single 378k-poly merged mesh via the Blender
MCP. Worth knowing if it needs regenerating:

1. The mesh has **417 loose parts**. The rotors were identified by labelling
   every loose part and classifying by its bounding-box centre — main rotor is
   `y > 8.8, z < 45`; tail rotor is `z > 44, x < -0.8, y < 8`. The `x < -0.8`
   term matters: the two vertical fins sit on the centreline at `x ≈ 0.1` while
   the tail rotor is offset to `x ≈ -2.3`. Without it you get a spinning fin.
2. Labels are baked into a per-vertex `part_id` attribute **before** any
   separation. Selecting by vertex index breaks, because `mesh.separate()`
   re-indexes the remaining mesh.
3. **The main rotor axis is found by fitting a circle to the blade tips**, not
   by reading the hub's bounding box. Converting the hub from local to world
   space by hand is easy to get wrong — dropping the object's `location` put
   the axis 34.7 cm off the mast and made the rotor orbit visibly. The circle
   fit is self-checking: tip radii about the true centre agree to 0.25 units,
   versus 1.93 about a wrong one. It also gives the true rotor radius, which
   sets the export scale.
4. Origins are set to the real rotor axes (3D cursor + `ORIGIN_CURSOR`), the
   hull is decimated to 20%, and the rig is scaled so the main rotor is a true
   8.33 m and rotated 180° about Z so the nose exports onto +Z.
5. Work happens on copies in a `WEB_EXPORT` collection. The original
   `CL0SED_B0DY` is never modified.

Resulting node graph:

```
HELI_Body        root · 180° about Y · scale 0.0975 · skids at y=0
├─ HELI_MainRotor   origin on the mast · spins about local Y
└─ HELI_TailRotor   origin on the tail rotor axis · spins about local X
```

## The mark

`components/Logo.tsx` inlines `public/logo.svg` so its two fills can be driven
from CSS. In the source art the shield is the single `lg-light` polygon and the
paths on top are the aircraft. Brand order is a dark shield with a light
aircraft; straight black would vanish on the void ground, so the shield is
lifted to `#2b303b` and the aircraft takes Lumen. The loading screen holds until
both the GLB and the renderer are up — WebGPU init finishes after the last byte
arrives, so gating on load progress alone drops the curtain on an empty scene.

## Credit

Attribution is a hard requirement, not a courtesy, and the data model enforces
it: `source` is a required field on the `Guide` type, so a guide cannot exist in
`data/guides.ts` without saying whose work it is.

Channel names, channel URLs and video titles in `data/creators.ts` are the
canonical ones YouTube reports for each video (oEmbed `author_name` /
`author_url`), not names typed from memory — regenerate them rather than editing
them by hand if a channel is renamed. Two channels listed as "Unlisted channel"
before this were in fact **LewF20** and **VGAiM**; that is exactly the kind of
error the canonical lookup exists to prevent.

## Content

All facts live in `data/` as typed modules, so pages stay presentational and
each fact has one home:

| File | Holds |
| --- | --- |
| `meta.ts` | Compile date, counts, Early Access date |
| `controls.ts` | Collective, cyclic, yaw, lift vector |
| `settings.ts` | Flight settings table, roll-vs-yaw camps |
| `keybinds.ts` | Three layouts, plus easily-missed hotkeys |
| `flying.ts` | Drill syllabus, J-hook steps, survival notes |
| `numbers.ts` | Drop heights, crate ceilings, payouts |
| `fleet.ts` | Airframes with cost and seats |
| `supplies.ts` | Supply types and pilot etiquette |
| `glossary.ts` | Terms of art |
| `videos.ts` | Every source video, transcribed or not |
| `guides.ts` | The written guides; `source` is a required field |
| `creators.ts` | Channels and videos, grouped — the credit page's data |

To add a fact, edit the data module — not the page. The J-hook phase list is the
one exception: it lives in `JHookScene.tsx` because the copy and the waypoint
positions have to stay in step.

## Commands

```sh
npm install
npm run dev        # http://localhost:3000
npm run build      # → out/
npm run typecheck
```

**Stop the dev server before building.** `next build` rewrites `.next`, and a
running `next dev` will then 500 with `Cannot find module './NNN.js'` until the
cache is cleared — `npm run clean` does that.

Do **not** try to fix this with a custom `distDir`. With `output: "export"` a
non-default `distDir` makes the exported site land in that directory instead of
`out/`, silently stranding the deploy target while builds still report success.

`npm run build` purges `out/` first, so routes deleted from `app/` cannot
survive into a deploy.

## Deploying to wardogspilot.com

Cloudflare Pages, static:

- Build command: `npm run build`
- Output directory: `out`
- Node version: 22+

Then add `wardogspilot.com` as a custom domain in the Pages project.

## Sourcing

Compiled from captioned community tutorials (see `/videos/`), read in full
rather than summarised from search results. The generated "WARDOGS wiki" SEO
sites were deliberately excluded — they contradict each other and cite settings
that appear in no gameplay footage.

Unofficial. Not affiliated with the developer.
