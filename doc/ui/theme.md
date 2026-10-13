# Theme and design tokens

`website/web/static/css/theme.css` defines every visual value of the interface
as a CSS custom property prefixed `--lk-`. The rest of the CSS only reads these
tokens, so changing the look (or adding a theme) means editing one file.

The current values follow the "F / Report" direction chosen for the redesign
(neutral greys, red/amber/green status colours) with a **cobalt blue accent**
for primary buttons, links, active states and the final hop of a redirect chain.

## How it works

```
theme.css             --lk-color-accent: #171717          (light)
                      --lk-color-accent: #EDEDED          (dark)
        │
bootstrap-bridge.css  --bs-primary: var(--lk-color-accent)
                      .btn-primary { --bs-btn-bg: var(--lk-color-accent) … }
        │
Bootstrap, base.css, utilities.css, page CSS, components
```

- Light values are declared on `:root, [data-bs-theme="light"]`, dark values on
  `[data-bs-theme="dark"]`. `js/theme_toggle.js` sets `data-bs-theme` on `<html>`
  (stored choice, otherwise the OS preference).
- `bootstrap-bridge.css` redeclares the `--bs-*` variables on `:root, [data-bs-theme]`,
  not only on `:root`. A custom property that references another one is resolved
  where it is declared, so declaring it on each theme element makes it pick up
  that theme's tokens.
- Theme-independent tokens (fonts, sizes, radii, spacing) are on `:root` only.

## Token reference

### Colours (light / dark)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--lk-color-bg` | `#FAFAFA` | `#0E0E10` | Page background (`--bs-body-bg`) |
| `--lk-color-surface` | `#FFFFFF` | `#17171A` | Cards, panels, menus |
| `--lk-color-surface-2` | `#F3F3F3` | `#1F1F23` | Subtle fill: secondary/tertiary bg, collapsed accordion, subtle primary bg |
| `--lk-color-surface-3` | `#EBEBEB` | `#2A2A2F` | Stronger fill |
| `--lk-color-ink` | `#171717` | `#EDEDED` | Body text (`--bs-body-color`) |
| `--lk-color-muted` | `#6B6B6B` | `#A0A0A0` | Secondary text (`--bs-secondary-color`) |
| `--lk-color-emphasis` | `#000000` | `#FFFFFF` | `--bs-emphasis-color` |
| `--lk-color-rule` | `#E6E6E6` | `#2A2A2E` | Borders (`--bs-border-color`) |
| `--lk-color-rule-strong` | `#C9C9C9` | `#3F3F45` | Hovered / emphasised borders, outline buttons |
| `--lk-color-accent` | `#2B4BEE` | `#7C93FF` | Accent, cobalt blue: primary action (`--bs-primary`, `.btn-primary`), active menu entry, final hop, hero icons |
| `--lk-color-accent-hover` / `-active` | `#2340D0` / `#1C34AD` | `#9AACFF` / `#6A82F5` | Primary hover / pressed |
| `--lk-color-on-accent` | `#FFFFFF` | `#0E0E10` | Text on the accent colour |
| `--lk-color-accent-soft` | `#EBEFFE` | `#1B2142` | Light accent background (`--bs-primary-bg-subtle`) |
| `--lk-color-link` / `-hover` | `#2B4BEE` / `#1C34AD` | `#8EA3FF` / `#B3C1FF` | Links (`--bs-link-color`) |
| `--lk-color-danger` | `#C8102E` | `#FF6B7D` | Malicious / error |
| `--lk-color-warning` | `#A15C00` | `#F2B661` | Suspicious / warning |
| `--lk-color-success` | `#1E7F4F` | `#4CC38A` | Safe / OK |
| `--lk-color-info` | `#2B4BEE` | `#8EA3FF` | Informational, help bubbles |
| `--lk-color-tree-node` | `#4682B4` | `#6FA8DC` | Node circles of the D3 tree |

Each status colour (`danger`, `warning`, `success`, `info`) also has `-soft`
(background, used as `--bs-*-bg-subtle`) and `-border` (used as
`--bs-*-border-subtle`). `danger` additionally has `-hover` and `--lk-color-on-danger`.

Tokens ending in `-rgb` (e.g. `--lk-color-accent-rgb: 23, 23, 23`) hold the same
colour as an RGB triplet, because Bootstrap builds `rgba(var(--bs-primary-rgb), .5)`
for its utilities. Keep both in sync when changing a colour.

### Other themed values

| Token | Use |
|-------|-----|
| `--lk-focus-ring`, `--lk-focus-border` | Keyboard focus ring and focused input border (accent) |
| `--lk-shadow-sm`, `--lk-shadow-md` | Shadows (`--bs-box-shadow-sm`, `--bs-box-shadow`) |
| `--lk-logo-filter` | `none` in light, `invert(1)` in dark (black PNG logo) |

### Typography, shape, spacing (all themes)

| Token | Value | Use |
|-------|-------|-----|
| `--lk-font-sans` | `"Geist", system-ui, …` | Body font (`--bs-body-font-family`) |
| `--lk-font-mono` | `"Geist Mono", ui-monospace, …` | URLs, hashes, code (`--bs-font-monospace`) |
| `--lk-font-size-base` / `-sm` / `-xs` | `0.9375rem` / `0.8125rem` / `0.75rem` | Text sizes |
| `--lk-font-weight-normal` / `-medium` / `-semibold` | `400` / `500` / `600` | Weights (headings use semibold) |
| `--lk-line-height` | `1.5` | Body line height |
| `--lk-radius-sm` / `-md` / `-lg` / `-pill` | `4px` / `6px` / `10px` / `999px` | Corners (`--bs-border-radius*`) |
| `--lk-space-1` … `--lk-space-7` | `0.25rem` … `3rem` | Spacing for our components |
| `--lk-content-max-width` | `1440px` | Wide layout |
| `--lk-transition-fast` | `120ms ease` | Hover transitions |

Geist and Geist Mono (v1.7.2, SIL Open Font License 1.1, from the npm package
`geist`) are self-hosted in `static/fonts/geist/` and declared in `css/fonts.css`.
They are variable fonts: one file per family covers every weight. To update
them, replace the two `.woff2` files (and `OFL.txt`), change the version in the
`fonts.css` header, then regenerate the SRI.

## Adding or changing a token

1. Add it to `theme.css` in **both** the light and the dark block (unless it is
   theme-independent).
2. If Bootstrap should follow it, map it in `bootstrap-bridge.css`.
3. Document it in the tables above.
4. `poetry run tools/generate_sri.py`.

## Adding a theme (future settings page)

A theme only redefines tokens, nothing else:

```css
[data-lk-theme="night"] { --lk-color-accent: #A897FF; … }
[data-lk-theme="night"][data-bs-theme="dark"] { … }
```

The theme is then selected by setting `data-lk-theme` on `<html>`, next to
`data-bs-theme`.
