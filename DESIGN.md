---
version: alpha
name: Lumen Edge
description: A sleek minimalist future dark system built on bottom-lit radial surfaces, inset hairline rims, and a single luminous horizon line that signals focus, activation, and depth.
theme: dark
colors:
  void: "#1b1c22"
  graphite: "#0b151e"
  panel: "#20222a"
  panel-raised: "#262932"
  slate-rise: "#47515c"
  hairline: "#2f3441"
  foreground: "#ffffff"
  muted: "#a8aebb"
  lumen: "#cfd8e6"
  surface: "#20222a"
  on-surface: "#ffffff"
  on-surface-muted: "#a8aebb"
  primary: "#cfd8e6"
  on-primary: "#0b151e"
  secondary: "#47515c"
  tertiary: "#2f3441"
  neutral: "#a8aebb"
  border: "#2f3441"
  focus: "#cfd8e6"
  error: "#ff8a8a"
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontWeight: 700
    fontSize: 44px
    lineHeight: 1.15
    letterSpacing: -0.02em
  display-md:
    fontFamily: Space Grotesk
    fontWeight: 600
    fontSize: 30px
    lineHeight: 1.2
    letterSpacing: -0.02em
  display-sm:
    fontFamily: Space Grotesk
    fontWeight: 600
    fontSize: 22px
    lineHeight: 1.3
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontWeight: 400
    fontSize: 17px
    lineHeight: 1.5
  body-md:
    fontFamily: Inter
    fontWeight: 400
    fontSize: 15px
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontWeight: 400
    fontSize: 13px
    lineHeight: 1.3
  label-sm:
    fontFamily: Space Grotesk
    fontWeight: 500
    fontSize: 12px
    lineHeight: 1.2
    letterSpacing: 0.08em
    textTransform: uppercase
  mono-sm:
    fontFamily: JetBrains Mono
    fontWeight: 400
    fontSize: 12px
    lineHeight: 1.3
rounded:
  none: 0
  sm: 4px
  md: 7px
  lg: 14px
  xl: 20px
  full: 999px
spacing:
  3xs: 2px
  2xs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 72px
  container-max: 1200px
  gutter: 24px
elevation:
  rim: inset 0 0 0 1px rgba(255, 255, 255, 0.1)
  rim-strong: inset 0 0 0 1px rgba(255, 255, 255, 0.16)
  card: 0 1px 1px rgba(0, 0, 0, 0.4), 0 12px 32px -12px rgba(0, 0, 0, 0.6)
  raised: 0 2px 4px rgba(0, 0, 0, 0.5), 0 24px 48px -16px rgba(0, 0, 0, 0.7)
  focus: 0 0 0 1px {colors.lumen}, 0 0 16px rgba(207, 216, 230, 0.25)
motion:
  ease-signature: cubic-bezier(0.15, 0.83, 0.66, 1)
  duration-slow: 1000ms
  duration-medium: 420ms
  duration-fast: 200ms
components:
  button-primary:
    backgroundColor: radial-gradient(ellipse at bottom, #47515c 0%, #0b151e 45%)
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px 18px
    minWidth: 120px
    rim: "{elevation.rim}"
    horizon: 70% wide bottom-edge highlight, opacity 0.2 at rest
  button-primary-hover:
    textColor: "{colors.foreground}"
    transform: scale(1.04) translateY(-3px)
    rim: "{elevation.rim-strong}"
    horizon: opacity 1.0
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 12px 18px
    rim: "{elevation.rim}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: 12px 18px
    border: 1px solid {colors.hairline}
  input-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px 14px
    rim: "{elevation.rim}"
  input-field-focus:
    backgroundColor: "{colors.panel-raised}"
    rim: "{elevation.rim-strong}"
    horizon: lumen line at base, opacity 1.0
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
    rim: "{elevation.rim}"
    shadow: "{elevation.card}"
    horizon: 70% wide bottom-edge highlight, opacity 0.18
  card-featured:
    horizon: lumen line at base, opacity 0.85
  checkbox:
    backgroundColor: "{colors.panel}"
    rounded: 6px
    size: 20px
    rim: "{elevation.rim}"
  checkbox-checked:
    backgroundColor: linear-gradient(180deg, {colors.slate-rise} 0%, {colors.graphite} 100%)
    iconColor: "{colors.lumen}"
    rim: "{elevation.rim-strong}"
    horizon: lumen line at base, opacity 1.0
  tabs:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.md}"
    padding: 4px
    rim: "{elevation.rim}"
  tabs-active:
    backgroundColor: radial-gradient(ellipse at bottom, #47515c 0%, #0b151e 45%)
    textColor: "{colors.foreground}"
    rounded: 5px
    padding: 8px 16px
    horizon: opacity 1.0
  horizon-panel:
    backgroundColor: radial-gradient(ellipse at bottom, #47515c 0%, #0b151e 45%)
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 24px 32px
    rim: "{elevation.rim}"
    shadow: "{elevation.raised}"
    horizon: pulsing lumen line, opacity 0.55 → 1.0
icons:
  library: Lucide
  url: https://lucide.dev/
  license: ISC
  strokeWidth: 1.5
  color: currentColor
---

## Overview

Lumen Edge is a dark, minimalist, futureward design system that reads as engineered glass at dusk. Every surface is sculpted by a soft bottom-lit radial gradient, every edge is reduced to a single 1px inset hairline, and every interactive state is signaled by a 70%-wide horizon of light at the base of the control rather than a shift in hue. The result is a quiet, technical, sub-chromatic interface where luminance, not color, carries hierarchy and motion.

The system is built around four reusable signals:

- A **radial-gradient surface** (`--surface-gradient`) that runs from Slate Rise at the bottom to Graphite at the top.
- A **hairline rim** (`--rim-inset`) — an inset 1px highlight at low alpha.
- A **horizon line** (`--horizon-line`) — a 70%-wide gradient highlight at the bottom edge.
- A **Lumen focus glow** — a cool-white outer ring used for keyboard focus.

A single signature motion curve, `cubic-bezier(0.15, 0.83, 0.66, 1)` at 1000ms, governs surface transitions and gives the system its slow, weighted feel.

## Colors

The palette is intentionally chromaless. Hierarchy is expressed through luminance and gradient direction, never through hue. There is no brand accent; the Lumen highlight is always cool-white.

| Token | Hex | Role |
| --- | --- | --- |
| `void` | `#1b1c22` | Primary page and canvas background |
| `graphite` | `#0b151e` | Gradient floor on raised surfaces |
| `panel` | `#20222a` | Card, sheet, and input surface |
| `panel-raised` | `#262932` | Focused input and elevated control surface |
| `slate-rise` | `#47515c` | Gradient peak on raised controls |
| `hairline` | `#2f3441` | Borders and dividers |
| `foreground` | `#ffffff` | Primary text and active iconography |
| `muted` | `#a8aebb` | Secondary text and resting labels |
| `lumen` | `#cfd8e6` | Signature horizon highlight and focus glow |

**Contrast.** Foreground on Void delivers ~16:1 contrast. Muted on Void delivers ~7:1, comfortably above WCAG AA for body text. Resting button text uses `rgba(255,255,255,0.66)` (≈10:1 on the gradient floor) and rises to full white on hover and focus.

## Typography

Three Google fonts cover display, body, and technical readouts.

- **Display — Space Grotesk** (600/700, tracking -0.02em) for headlines and signature UI labels.
- **Body — Inter** (400/500, line-height 1.5) for paragraphs and interface copy.
- **Mono — JetBrains Mono** (400/500) for stats, tags, and numeric readouts.

The scale is a modular ~1.2 ratio anchored at 15px body:

| Level | Size | Weight | Family |
| --- | --- | --- | --- |
| `display-lg` | 44px | 700 | Space Grotesk |
| `display-md` | 30px | 600 | Space Grotesk |
| `display-sm` | 22px | 600 | Space Grotesk |
| `body-lg` | 17px | 400 | Inter |
| `body-md` | 15px | 400 | Inter |
| `body-sm` | 13px | 400 | Inter |
| `label-sm` | 12px | 500 | Space Grotesk, uppercase, +0.08em |
| `mono-sm` | 12px | 400 | JetBrains Mono |

Labels use uppercase tracking to read as quiet technical annotations, never as headings.

## Layout

A 12-column-equivalent flow built on flexible primitives, anchored at a 1200px max-width container and a 24px gutter. The spacing scale is on a 4px grid: `2, 4, 8, 12, 16, 24, 32, 48, 72`.

- Sections breathe with `2xl` (48px) of vertical rhythm.
- Cards and panels group with `lg` (24px) of internal padding.
- Inputs, buttons, and tabs share `sm`/`md` (12-16px) of horizontal padding for visual continuity.
- Stack primitives (`.stack`, `.stack-lg`) handle vertical rhythm; `.row` handles horizontal grouping.

Density should remain calm. Avoid stacking more than three luminous horizon lines in a single viewport — they are intended to feel like signals, not patterns.

## Elevation & Depth

Depth is communicated by three layered signals, not by drop shadows alone:

1. **Surface gradient.** Raised controls and the signature panel use a radial gradient anchored at the bottom — Slate Rise rising to Graphite — that mimics light spilling onto the control from below.
2. **Hairline rim.** A 1px inset highlight at `rgba(255,255,255,0.1)` outlines every control. On hover and focus it strengthens to `0.16` to acknowledge the interaction.
3. **Horizon line.** A 70%-wide gradient line sits at the bottom edge of buttons, inputs, cards, tabs, and the Horizon Panel. At rest it sits at ~20% opacity; on hover/focus/active it rises to full opacity. On the signature panel it pulses gently between 55% and 100%.

Outer shadows are reserved for cards (`--shadow-card`) and the signature panel (`--shadow-raised`). They are soft, dark, and offset downward — they sit beneath the surface, never above it.

## Shapes

A small radius vocabulary keeps the system coherent:

- `7px` for buttons, inputs, chips, and tabs — the primary control radius inherited from the source material.
- `14px` for cards and panels.
- `20px` for hero containers when extra softness is needed.
- `999px` (pill) reserved for status dots, chips, and toggles.

No sharp corners are used anywhere. No skeuomorphic ornamentation. Borders are reduced to inset hairlines wherever possible; visible 1px borders use `hairline (#2f3441)` for dividers.

## Components

All components share the four reusable signals above. The horizon line is the common visual anchor.

### Button

A radial-gradient body, an inset hairline rim, and the horizon line at the base. On hover the button lifts 3px and scales 1.04 with a slow 1000ms ease; the rim and horizon brighten simultaneously. Three variants: `btn` (primary, gradient), `btn-secondary` (flat panel), `btn-ghost` (outlined). Size modifiers `btn-sm` and `btn-lg`.

### Input

Panel-surface base, inset hairline rim, and a hidden Lumen horizon line that fades in on focus. Wrap the `<input>` in `.input-wrap` inside a `.field` to enable the focus horizon. Placeholder text uses `muted` at 0.7 opacity.

### Card

Panel surface with a faint internal radial gradient, 14px radius, inset hairline rim, and a permanent low-opacity horizon line at the base. Add `is-featured` to brighten the horizon to a full Lumen line, distinguishing hero cards without using color.

### Checkbox

20px rounded square, panel base, inset rim. When checked, the box fills with a vertical Slate Rise → Graphite gradient, a Lumen check icon appears with a soft scale-in, and a Lumen horizon line confirms the state at the base of the box.

### Tabs

A single-row pill container with a hairline rim. The active tab is a raised radial-gradient surface with the horizon line lit; inactive tabs sit flat at muted text and brighten to foreground on hover.

### Horizon Panel (signature)

A wide, low-profile command/status panel that showcases the full vocabulary: radial-gradient surface, hairline rim, soft outer shadow, and a 70%-wide pulsing Lumen horizon line. It hosts an eyebrow label, a panel title, a status dot, and a primary action — acting as the system's hero specimen.

### Chip

A pill with the standard rim and a JetBrains Mono label. Used for tags, status counts, and small technical metadata.

### Icons

Icons come from **Lucide** (https://lucide.dev/, ISC). They render in `currentColor` at `stroke-width: 1.5` to match the hairline rim weight. Use `.icon` for inline sizing via `font-size`. Do not mix Lucide with other libraries.

## Do's and Don'ts

**Do**

- Let the horizon line carry interactive state — brighten it on hover, focus, and active rather than shifting hue.
- Use the slow `cubic-bezier(0.15, 0.83, 0.66, 1)` ease at 1000ms for surface transitions. It is part of the brand.
- Keep the palette luminance-only. Reach for Lumen when something needs to glow; reach for muted when something needs to recede.
- Pair Space Grotesk display with Inter body, and reserve JetBrains Mono for numeric or technical content.
- Anchor every raised control to the same gradient direction (ellipse-at-bottom) so the system reads as lit from a single virtual source below.

**Don't**

- Don't introduce a chromatic accent (green success, blue link, etc.) — express state through luminance instead.
- Don't replace the horizon line with a full underline or a border-bottom. The 70% width and the soft falloff are load-bearing.
- Don't stack heavy outer shadows on small controls. Buttons and inputs rely on the inset rim, not on drop shadows.
- Don't mix radius values inside a single component cluster. Buttons and inputs share 7px; cards and panels share 14px.
- Don't animate properties that would disturb the calm — avoid bouncy easings, hue shifts, and any motion shorter than 200ms for surface transitions.

## Framework Adaptation

The system is plain CSS and is framework-agnostic. To adapt:

- Map the YAML tokens above to your framework's theme primitives (Tailwind config, CSS-in-JS theme, design tokens JSON).
- Preserve the four signals: radial gradient, inset rim, horizon line, and Lumen focus glow. Replicating any single one in isolation will not produce the system's feel.
- Honor `prefers-reduced-motion: reduce`; the bundled CSS already collapses all transitions to 1ms under that media query.
- When porting to React/Vue/Svelte, render the horizon line as a `::before` pseudo-element rather than as an extra DOM node, so the structural HTML stays semantic.
