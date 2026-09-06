# wardogspilot.com

The WARDOGS helicopter reference. Static site, no client-side JavaScript.

## Stack

- **Astro 5**, static output (`output: "static"`).
- **Lumen Edge** design system — plain CSS, vendored at `src/styles/system.css`.
- No UI framework, no CSS framework, no runtime JS.

## Design system wiring

The system enters the app in exactly one place:

```
src/styles/system.css      the vendored design system (do not edit)
      ↑ @import
src/styles/global.css      site-level scaffolding built only from system tokens
      ↑ import
src/layouts/Base.astro     the single import for the whole app
```

Every page uses `Base.astro`, so every page gets the system once. The build
emits **one** CSS bundle shared by all routes. Nothing else may import
`system.css` or `global.css`.

`DESIGN.md` (the system's own spec) and `DESIGN-LICENSE.md` are kept in the repo
root for reference.

### House rules inherited from DESIGN.md

- **No chromatic accents.** State is luminance, never hue. Severity in tables is
  a leading rule that runs Lumen → Slate Rise → Hairline in brightness.
- **The horizon line carries interaction.** Hover, focus and "read this"
  brighten the 70%-wide bottom highlight rather than shifting color.
- **Radius vocabulary:** 7px controls, 14px cards and panels. Do not mix within
  a cluster.
- **Type:** Space Grotesk display, Inter body, JetBrains Mono for anything
  numeric or technical.
- **Icons:** Lucide only, stroke-width 1.5, inlined in `src/components/Icon.astro`.

## Content

All page content lives in `src/data/` as typed modules, so pages stay
presentational and facts have one home:

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

To add a fact, edit the data module — not the page.

## Commands

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # → dist/
npm run preview   # serve dist/
```

## Deploying to wardogspilot.com

Cloudflare Pages, static:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 22+

Then add `wardogspilot.com` as a custom domain in the Pages project.

## Sourcing

Content is compiled from captioned community tutorials (see `/videos/`), read in
full rather than summarised from search results. The generated "WARDOGS wiki"
SEO sites were deliberately excluded — they contradict each other and cite
settings that appear in no gameplay footage.

Unofficial. Not affiliated with the developer.
