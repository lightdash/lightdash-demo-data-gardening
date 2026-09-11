# Lightdash Brand Theme

Apply this brand consistently to every data app you generate.

## Assets available in this design

- **CSS**: `brand.css` — load it and use its CSS variables and helper classes
  (`.ld-card`, `.ld-button`, `.ld-metric`, `.ld-metric-label`). All design tokens
  live in `:root`.
- **Font**: `Inter.woff2` (variable, weights 100–900) — already wired up via
  `@font-face` in `brand.css`. Use `font-family: var(--ld-font)` everywhere.
- **Images** (in `images/`):
  - `lightdash-logo-dark.svg` — full wordmark, dark ink. Use on light backgrounds.
  - `lightdash-logo-white.svg` — full wordmark, white. Use on dark / purple backgrounds.
  - `lightdash-icon.svg` — square app icon (purple background, white mark).
  - `lightdash-icon-round.svg` — circular icon variant.
  - `lightdash-logo.png` — raster wordmark fallback.
  - `lightdash-favicon-32.png`, `lightdash-icon-180.png` — favicon / touch icon.

## Color

| Role | Token | Hex |
|------|-------|-----|
| Primary brand | `--ld-purple` | `#7262FF` |
| Primary (hover/pressed) | `--ld-purple-dark` | `#4F3FD6` |
| Brand tint (chips, soft fills) | `--ld-purple-tint` | `#EFEDFF` |
| Primary text | `--ld-ink` | `#1A1B1E` |
| Headings / secondary text | `--ld-slate` | `#394B59` |
| App background | `--ld-bg` | `#FEFEFE` |
| Card surface | `--ld-surface` | `#FFFFFF` |
| Borders / dividers | `--ld-border` | `#DEE2E6` |

**Data visualization** — use the categorical palette in order:
`--ld-viz-1 … --ld-viz-6` = `#7262FF`, `#3B5BDB`, `#DE7F0B`, `#2B8A3E`, `#4170CB`, `#868E96`.

## Typography

- Font: **Inter** for all UI and content. Monospace: `var(--ld-font-mono)`.
- Weights: 400 body, 500 emphasis / buttons / labels, 600 headings.
- Headings use `--ld-slate`, tight letter-spacing (`-0.01em`).
- Big numbers / KPIs: use `.ld-metric` with an uppercase `.ld-metric-label` above.

## Layout & style

- Generous whitespace, light surfaces, subtle shadows (`--ld-shadow`).
- Rounded corners: `--ld-radius` (8px).
- Cards over raw tables; lead with the headline metric.
- Purple is an **accent**, not a fill — use it for primary actions, key figures,
  active states and a single hero element, not large background blocks.
- Put a Lightdash logo in the header; use the white wordmark only on dark/purple bars.
