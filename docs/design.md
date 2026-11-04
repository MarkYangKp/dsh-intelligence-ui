# Design system v3 — Precision Editorial

This document explains the visual language used by the 44 components. The implementation lives in
[`src/ui/theme.js`](../src/ui/theme.js) (tokens) and [`src/ui/shared.jsx`](../src/ui/shared.jsx)
(shared atoms); components consume tokens only.

## Why v3

The host app is an **ink typography system**: near-black body text, grey levels, hairlines, and a
small amount of semantic colour. The plugin's earlier versions were flat and monochrome because:

1. they used the host **brand** colour for data series — which is near-black in light mode and
   near-white in dark mode, so every chart, metric and progress bar was grayscale;
2. light-mode surface layers are all white, so structure was almost invisible;
3. some referenced theme tokens did not exist, so typography silently fell back to defaults.

v3 fixes all three:

- **Data colour** uses the host's business-blue accent (`--dsw-alias-state-business-primary`,
  `#4176e6` light / `#7aaaff` dark); green/amber/red express status only; brand ink is reserved
  for body text and the contrast button.
- **Structure** comes from typography, hairline borders and layered surfaces — not decoration.
- **A little highlight goes a long way**: one or two accent moments per screen.

## Hard rules

- Never hard-code colours (`#hex`, `rgb()`, `hsl()`) — use `T` / `TINT` / `INK` / `PALETTE`.
- No gradients.
- No `text-transform: uppercase`; small labels rely on size, weight and tracking.
- Font sizes come from the seven `FS` steps only (captions/axes always `FS.caption`).
- Spacing follows the 8px rhythm from `S` (2/4/8/12/16/20/24/32).
- Static surfaces have no shadows; only floating surfaces use the host elevation tokens.
- Body text uses `T.ink`; secondary text `T.inkSecondary`; captions/axes `T.inkTertiary`/`T.inkCaption`.
  At body size (≥13px) use `inkSecondary` or darker — `inkTertiary` is reserved for captions and
  auxiliary metadata so WCAG AA contrast holds.
- No horizontal overflow at 390px; long numbers use `NUMS` (tabular figures); long strings wrap.
- Interactive elements keep hover/focus/active feedback and respect `prefers-reduced-motion`.
- **Component schemas must not change** without updating the fingerprint, prompt and docs
  (`test/budget-test.mjs` guards the schema).

## Tokens (`src/ui/theme.js`)

| Purpose                         | Tokens                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Canvas & surfaces               | `T.canvas` `T.surface` `T.surfaceRaised` `T.surfaceSunken` (inset) `T.surfaceTint` (soft block) `T.surfaceHover`      |
| Borders                         | `T.hairline` (dividers) `T.border` (structure) `T.borderStrong` (card outline) `T.borderHeavy` (emphasis)             |
| Ink                             | `T.ink` `T.inkSecondary` `T.inkTertiary` `T.inkCaption` `T.inkInverted`                                               |
| Accent                          | `T.accent` (data/emphasis) `T.accentText` (links)                                                                     |
| Semantic                        | `T.success` `T.warning` `T.danger` (dots, fills, strokes)                                                             |
| Semantic ink                    | `INK.accent/success/warning/danger` — **for text/icons**, mixed with ink so light mode darkens and dark mode lightens |
| Tints                           | `TINT.accent/success/warning/danger/neutral`, `TINT.accentLine`                                                       |
| Series palette                  | `PALETTE` (blue → green → amber → red → teal → violet → rust), derived from theme tokens                              |
| Code                            | `T.codeBg` `T.codeBanner`                                                                                             |
| Buttons                         | `T.buttonFill` `T.buttonFillHover`                                                                                    |
| Type                            | `FS.caption/small/body/lead/title/heading/display` (11/13/14/15/16/19/26 at the default body size)                    |
| Weight / line height / tracking | `FW.*` `LH.*` `TRACK.*`                                                                                               |
| Spacing / radii                 | `S.xxs…xxxl`, `radius`, `radiusMd`, `radiusSm`, `radiusXs`, `radiusFull`                                              |
| Numbers                         | spread `...NUMS`                                                                                                      |
| Elevation                       | `ELEVATION.soft/panel` (only for genuinely floating surfaces)                                                         |

Helpers: `tint(color, %)`, `soften(color, %, surface)`, `alias(kind, value)`.

## Type scale

Seven steps, scaled from the host's body font size so the UI follows the user's reading-size
setting:

| Step      | Default | Used for                                |
| --------- | ------: | --------------------------------------- |
| `caption` |    11px | axis labels, captions, metadata         |
| `small`   |    13px | secondary body, table headers, controls |
| `body`    |    14px | body text                               |
| `lead`    |    15px | emphasised body                         |
| `title`   |    16px | section titles, card titles             |
| `heading` |    19px | page/report headings                    |
| `display` |    26px | metric values, chart totals             |

## Shared atoms (`src/ui/shared.jsx`)

- `Surface({ tone, padding, border, radius, elevated })` — the one surface container.
- `Eyebrow` — small label above a metric or block.
- `PanelTitle({ children, right })` — panel heading with optional right-hand note.
- `StatusDot({ color, size })`, `Delta({ value, trend })`, `IconTile({ glyph, tone, size })`.
- `Rule({ vertical })`, `EmptyState`, `Note` — dividers, empty states, footnotes.
- `ExpandToggle` / `useExpanded` — compact-preview expand control.
- `PlayControls` — playback controls for animated views.
- `kids(props, renderNode)` and syntax-highlight helpers.

## Component guidance

### Containers

- **Card** — one surface, 16px radius, hairline outline. `accent` adds a 2px top rule; use it
  sparingly (one or two per screen). `elevated` switches to a floating surface.
- **CardHeader** — optional `IconTile`, title at `FS.title`, subtitle at `FS.small`.
- **Section** — accent marker + hairline + title; prefer grouping with `Section` over many cards.
- **Callout** — tinted background, 3px left rule, semantic dot and `INK` title; body in ink.
- **Quote** — left rule plus optional source line.

### Data

- **StatCard** — eyebrow → large tabular value (auto-downsizes by length) → delta pill + note;
  emoji sits in an `IconTile`; accent is a 2px top rule shared with `Card`.
- **Table / SearchTable** — framed surface; header uses an inset background; hairline row
  separators; numbers right-aligned and tabular; status column = raw-colour dot + `INK` text;
  formatted summary row; 8-row preview with expand.
- **ProgressBar / ComparisonBar** — 6px/8px rounded tracks, semantic fills, right-aligned values.
- **Timeline** — 2px rail, ringed nodes, time eyebrow.
- **Steps** — 20px state circles (done / current / todo) with connectors.
- **Checklist** — semantic glyphs, strike-through for done.

### Visualisation

- **Chart** — 3 hairline grid lines plus a structural zero baseline; HTML axis labels fixed at
  `FS.caption`; `PALETTE` series; solid markers with a surface ring; adaptive bar widths; legend
  with 8px dots.
- **PieChart** — 18px ring, 2px slice gaps, `FS.display` total in the centre, legend with
  percentages.
- **Sparkline** — data-extent scaling, tinted area, end dot.
- **Heatmap** — framed plate with a low → high legend, responsive cells.
- **Map** — schematic world land (tinted, hairline), graticule, accent markers/strokes, dashed
  links, collision-avoided labels; `bbox` expands outward so the requested region is never cropped.

### Text & code

- **Heading** — levels map to the Markdown heading scale; don't out-shout body text.
- **TextContent** — ink body; `muted` only for secondary notes.
- **BulletList** — custom accent markers; ordered lists use caption numerals.
- **KeyValue** — caption labels, medium values, responsive columns.
- **Badge** — 22px pill, tinted background, semantic dot, `INK` text.
- **CodeBlock** — 34px toolbar (language chip, title, line count, expand, copy), inset body,
  sticky line-number gutter, highlighted lines, internal horizontal scroll, 18-line preview.
- **Diff** — filename/title banner, `+N/−M` pills, dual line-number gutters, host diff row tints.
- **FileTree** — 24px monospace rows, carets, A/M/D pills.

### Process & controls

- **TreeView / Diagram** — framed figures; nodes grow from circle to pill as labels get longer;
  three states (current / visited / unvisited); order tags; diagram content is cropped to its
  content bounds; edge labels avoid nodes and each other; playback controls stay low-weight.
- **Button** — host contrast button for primary; default is surface + border; ghost is
  transparent with hover.
- **Tabs** — underline style, accent indicator.
- **SegmentedControl** — soft track with a selected pill.
- **Accordion** — hairline separators, rotating caret, indented content.

## Verifying visually

```bash
pnpm build
pnpm shot                                # docs/gallery{,-dark,-mobile}.png + gallery.html
pnpm preview -- --name me --theme both   # isolated preview in /tmp/iui-preview-me/
pnpm test:design                         # computed-style gates in headless Chrome
```

The gallery renders against host theme tokens. When no local host snapshot is available it uses
`test/fixtures/theme-fallback.css` (an original approximation). Maintainers can generate an exact
snapshot with `node scripts/extract-theme.mjs`; the generated file is git-ignored because it is
product styling, not part of this project's distribution.
