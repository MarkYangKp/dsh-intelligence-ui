# Component reference

44 components for OpenUI programs inside the chat reply. Positional arguments are bound in the
order shown; `?` marks optional arguments. Program syntax rules live in the capability prompt
injected by the host (`index.js`); design tokens are in [`design.md`](design.md).

> The host injects an equivalent capability reference into the model's runtime context on every
> turn, so an agent can write these without reading this file. This page is for humans.

## Primitives

| Component | Signature                                                                                                                                                                                                                              | Notes                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Box`     | `Box([children], display?, direction?, gap?, align?, justify?, wrap?, width?, height?, minWidth?, maxWidth?, padding?, margin?, background?, border?, radius?, shadow?, position?, top?, right?, bottom?, left?, overflow?, opacity?)` | Free-form composition. `background`/`border` accept theme-token CSS values (`var(--dsw-…)`, `color-mix(…)`), never raw hex.                        |
| `Row`     | `Row([children], gap?, align?, justify?, wrap?)`                                                                                                                                                                                       | Horizontal stack shorthand.                                                                                                                        |
| `Col`     | `Col([children], gap?, align?)`                                                                                                                                                                                                        | Vertical stack shorthand.                                                                                                                          |
| `Text`    | `Text(text, size?, weight?, color?, align?, mono?, lineHeight?, transform?, letterSpacing?, truncate?, maxLines?)`                                                                                                                     | `size` = px number or `sm/md/lg/xl`; `weight` = `normal/medium/semibold/bold`; `color` = `primary/secondary/tertiary/brand/success/warning/error`. |
| `Icon`    | `Icon(name, size?, color?)`                                                                                                                                                                                                            | Emoji/glyph string rendered as a themed icon slot.                                                                                                 |
| `Image`   | `Image(src, alt?, width?, height?, radius?, fit?)`                                                                                                                                                                                     | Remote/local image with theme radius.                                                                                                              |
| `Link`    | `Link(text, href, external?)`                                                                                                                                                                                                          | Accent-coloured link, opens externally when `external`.                                                                                            |

## Layout

| Component | Signature                                                                | Notes                                                                                                                            |
| --------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `Stack`   | `Stack([children], direction?, gap?, align?, justify?, padding?, wrap?)` | `direction` = `column/row`; `align` = `start/center/end/stretch`; `justify` = `start/center/end/between`. Root of every program. |
| `Grid`    | `Grid([children], columns?, gap?, minWidth?)`                            | Auto-fit grid; wraps on narrow screens.                                                                                          |
| `Divider` | `Divider(label?)`                                                        | Hairline rule with an optional centred label.                                                                                    |
| `Spacer`  | `Spacer(size?)`                                                          | Vertical spacing.                                                                                                                |

## Containers

| Component    | Signature                                        | Notes                                                                                                                              |
| ------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Card`       | `Card([children], padding?, accent?, elevated?)` | `accent` = `none/brand/success/warning/error/info/neutral` (2px top rule; use 1–2 per screen); `elevated` adds a floating surface. |
| `CardHeader` | `CardHeader(title, subtitle?, icon?)`            | `icon` is one emoji, rendered in a tinted icon tile.                                                                               |
| `Section`    | `Section(title, subtitle?, [children])`          | Accent marker + hairline grouping; prefer over many sibling `Card`s.                                                               |
| `Callout`    | `Callout(title?, text, variant?)`                | `variant` = `info/success/warning/error`.                                                                                          |
| `Quote`      | `Quote(text, source?)`                           | Quote with a source line.                                                                                                          |

## Text

| Component     | Signature                                                          | Notes                                                                                                                                                |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Heading`     | `Heading(text, level?)`                                            | `level` = `1/2/3`, aligned with the Markdown heading scale.                                                                                          |
| `TextContent` | `TextContent(text, size?, muted?, weight?, mono?)`                 | `size` = `sm/md/lg/xl`.                                                                                                                              |
| `BulletList`  | `BulletList(items, ordered?)`                                      | `items` = `string[]`.                                                                                                                                |
| `KeyValue`    | `KeyValue(items, columns?)`                                        | `items` = `[{label, value}]`; collapses to one column on mobile.                                                                                     |
| `CodeBlock`   | `CodeBlock(code, language?, title?, showLineNumbers?, highlight?)` | `language` supports `js/ts/python/json/bash/http/sql/css/html/yaml`; `highlight` = 1-based line numbers. Long code collapses with an expand control. |
| `Badge`       | `Badge(text, variant?)`                                            | Pill; `variant` = `default/success/warning/error/brand/info/neutral`.                                                                                |
| `BadgeGroup`  | `BadgeGroup(items, variant?)`                                      | `items` = `string[]`.                                                                                                                                |

## Data

| Component       | Signature                                                                                             | Notes                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatCard`      | `StatCard(label, value, delta?, trend?, icon?, note?, accent?)`                                       | `trend` = `up/down/flat`; `accent` = `none/brand/success/warning/error`; `icon` ≤ 1 emoji; `note` for unit/scope.                                                                  |
| `Table`         | `Table(title?, columns?, data, compact?, sortable?, striped?, columnSpecs?, highlightRow?, summary?)` | `data` = object rows; `columnSpecs` = `[{key, align?, format?, status?}]` with `format` = `text/number/percent/currency/compact`; `summary` renders a footer row; 8 rows collapse. |
| `SearchTable`   | `SearchTable(title?, columns?, data, searchPlaceholder?, emptyText?, compact?, columnSpecs?)`         | Live client-side filter across columns.                                                                                                                                            |
| `ProgressBar`   | `ProgressBar(label?, value, max?, variant?)`                                                          | Semantic fill colour.                                                                                                                                                              |
| `ComparisonBar` | `ComparisonBar(title?, items, showValue?, unit?)`                                                     | `items` = `[{label, value, variant?}]`.                                                                                                                                            |
| `Timeline`      | `Timeline(items)`                                                                                     | `items` = `[{title, description?, time?, variant?}]`.                                                                                                                              |
| `Steps`         | `Steps(items, current?)`                                                                              | `items` = `string[]`; `current` is a 0-based index.                                                                                                                                |
| `Checklist`     | `Checklist(title?, items)`                                                                            | `items` = `[{text, status?}]`; `status` = `done/doing/todo`.                                                                                                                       |

## Charts

| Component   | Signature                                                                                          | Notes                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Chart`     | `Chart(title?, type, series, data?, labels?, height?, yFormat?, showLegend?, showGrid?, stacked?)` | `type` = `bar/line/area`; `series` = `[{name, values:number[]}]`; `yFormat` = `number/compact/percent`; omit colours — the theme assigns the palette. |
| `PieChart`  | `PieChart(title?, data, donut?, size?)`                                                            | `data` = `[{label, value}]`; `donut` shows the total in the centre.                                                                                   |
| `Sparkline` | `Sparkline(values, width?, height?)`                                                               | Inline trend line.                                                                                                                                    |
| `Heatmap`   | `Heatmap(title?, data, columns?, cell?)`                                                           | `data` = `[{label?, value}]`; contribution-style grid.                                                                                                |

## Geography

| Component | Signature                                                  | Notes                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Map`     | `Map(title?, points, links?, bbox?, height?, showLabels?)` | `points` = `[{lat, lon, label?, value?}]`; `links` = `[[i, j]]`; `bbox` = `[west, south, east, north]` (expands outward, never crops the requested area). Schematic world basemap, not for navigation. |

## Code & files

| Component  | Signature                 | Notes                                                                                  |
| ---------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `Diff`     | `Diff(filename?, diff)`   | Unified diff; computes `+N/−M`, dual line-number gutters, 30 rows collapse.            |
| `FileTree` | `FileTree(title?, files)` | `files` = `[{path, status?}]`; `status` = `added/modified/deleted`. 15 files collapse. |

## Process & structure

| Component  | Signature                                                             | Notes                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TreeView` | `TreeView(title?, values, traversals?, height?)`                      | `values` = level-order array with `null` placeholders; `traversals` = subset of `pre/in/post/level`; playback controls.                                                               |
| `Diagram`  | `Diagram(title?, width?, height?, nodes, edges, steps?, nodeRadius?)` | `nodes` = `[{id, label, x, y, variant?, sub?}]`; `edges` = `[{from, to, label?, dashed?}]`; `steps` = `[{label, highlight?, visited?, note?}]`; step playback highlights nodes/edges. |

## Interactive

| Component          | Signature                          | Notes                                                                                        |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `Button`           | `Button(label, action?, variant?)` | `variant` = `primary/default/ghost`; clicking gives in-place local feedback (no navigation). |
| `Tabs`             | `Tabs(items, active?)`             | `items` = `[{label, content}]`; `active` = index.                                            |
| `Accordion`        | `Accordion(items)`                 | `items` = `[{title, content}]`; first item starts open.                                      |
| `SegmentedControl` | `SegmentedControl(items, active?)` | Compact 2–4 option switch; `active` = index.                                                 |

## Program syntax

```openui
root = Stack([header, kpis, chart], "column", 16)
header = Heading("Weekly revenue", 2)
kpis = Grid([a, b], 2, 12, 150)
a = StatCard("Revenue", "¥84,300", "+12.6%", "up", null, "GMV, tax included", "brand")
b = StatCard("New users", "1,204", "+3.1%", "up", null, "vs. last week", "success")
chart = Chart("Last 7 days", "area", [{name: "Revenue", values: [82, 94, 110, 129, 105, 138, 152]}], [], ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], 220)
```

Hard rules (violations do not render correctly):

1. First statement must be `root = Stack([...])`; use positional arguments only.
2. Every defined variable must be referenced.
3. Objects use `:`, and non-ASCII keys must be double-quoted: `{"status": "ok"}`.
4. String concatenation is `+`; built-ins are limited to
   `@Count @Sum @Avg @Min @Max @Filter @Sort @Round @Each @First @Last @Abs @Floor @Ceil`.
5. Loop templates must be inline: `@Each(rows, "r", TextContent(r.title, "sm"))`.
6. Do not write colours — the theme assigns them.
7. Prefer an in-place component over raw HTML-like structures; unsupported components degrade to
   a local notice instead of breaking the reply.

See `examples/` for nine complete programs (report, comparison, tutorial, incident review,
research brief, code review, code change, geo distribution, syntax highlighting).
