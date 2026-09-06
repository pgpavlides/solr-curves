# wardogspilot.com

The WARDOGS helicopter reference, with the three concepts that text cannot carry
rendered in 3D.

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

| Scene | Page | What it is for |
| --- | --- | --- |
| `HeroScene` | `/` | An MH-6 built from primitives — no external model to download or go stale |
| `LiftVectorScene` | `/controls/` | Tilt the rotor disc and watch total lift split into vertical and horizontal components. Live readout of vertical lift % and the extra collective needed to hold altitude |
| `JHookScene` | `/flying/` | The J-hook as a scrubable 3D path; the phase list beside it lights up to match |
| `DropScene` | `/numbers/` | Passenger drop height against a 1.8 m figure, to scale |

`LittleBird.tsx` is shared geometry. Dimensions are roughly true to the real
aircraft (7.5 m rotor, 5-bladed head).

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
