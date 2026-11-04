# Architecture

`dsh-intelligence-ui` is a **single DSH plugin with two halves**:

| Half   | Entry                                         | Runs in       | Responsibility                                                                                                                                                                |
| ------ | --------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host   | `index.js`                                    | DSH Node host | Injects two runtime prompt modules (presentation policy + capability reference) and declares the bundle patch.                                                                |
| Client | `lib/client.js` (built from `src/client.jsx`) | DSH Web UI    | Registers an `assistant-step` renderer at priority −20, splits reply text into Markdown and `openui` fences, compiles structured Markdown, and renders the component library. |

The host half is plain JavaScript (no build step); the client half is an esbuild bundle in the
host's `ModuleLoader` factory format. React and the host platform modules are external — the
plugin does not ship its own React.

## Reply pipeline

````
assistant-step text block
        │
        ├─ contains ```openui fences ──► parse → evaluate → render components
        │                                  (text outside fences stays Markdown)
        ├─ no fence, message settled ──► compiler: Markdown → OpenUI program → render
        │                                  (tables, KPI lists, ordered steps)
        └─ otherwise ──────────────────► host Markdown renderer, unchanged
````

Key properties:

- **Insertion, not replacement.** A reply can be `text → chart → text`; every fence is rendered
  in place and the surrounding Markdown is untouched.
- **Streaming-safe.** An unfinished fence renders as it arrives; the last valid tree is kept
  while a chunk is malformed, and the final frame does not remount controls.
- **Recoverable.** A program written as a plain code block with `root = …` is recovered; a
  malformed block falls back to a local notice without dropping the rest of the message.

## Source layout

```
src/
├── client.jsx                 renderer registration, fence scanning, message isolation, UI CSS
├── openui-runtime.jsx         library assembly, parser/evaluator/render pipeline, arg repair
├── ui/
│   ├── theme.js               design tokens (colors, type scale, spacing, radii, palette, INK)
│   ├── shared.jsx             shared atoms (Surface, Delta, IconTile, ExpandToggle, …)
│   ├── primitives.jsx         Box Row Col Text Icon Image Link Stack Grid Divider Spacer
│   ├── containers.jsx         Card CardHeader Section Callout Quote
│   ├── text.jsx               Heading TextContent BulletList KeyValue Badge CodeBlock
│   ├── files.jsx              Diff FileTree
│   ├── data.jsx               StatCard Table SearchTable ProgressBar ComparisonBar Timeline Steps Checklist
│   ├── charts.jsx             Chart PieChart Sparkline Heatmap
│   ├── map.jsx                Map
│   ├── process.jsx            TreeView Diagram
│   └── controls.jsx           Button Tabs Accordion SegmentedControl
├── compiler.mjs               deterministic Markdown → OpenUI compiler (pure, zero deps)
├── render-safety.jsx          error boundaries, budgets, safe text, clipboard lifecycle
├── world-map.mjs              simplified world land outline (Natural Earth, public domain)
└── compiler-runtime-check.mjs test helper: compiles the JSX runtime for Node-based tests
```

`openui-runtime.jsx` assembles the ordered component list (the order is part of the schema
fingerprint) and owns the tolerant binding layer:

- positional arguments are bound in declaration order by default;
- named arguments written as `=` or `:` are normalised;
- a value is only relocated to another slot when no slot accepts its type/shape;
- bare child elements are wrapped into the `children` array;
- `None` / `True` / `undefined` literals are normalised;
- unknown enum synonyms (`column`, `smooth`, `danger`, `small`, …) are mapped;
- resource budgets bound source size, nesting depth, reference expansion and data volume.

## Robustness model

Four isolation layers, from outside in:

1. **Message** — one message cannot break the conversation; a failed message renders a local notice.
2. **Text block** — preprocessing failures are contained per block.
3. **Fence** — each OpenUI block is independent; a bad program does not affect siblings.
4. **Component** — each component mounts behind an error boundary; a failed chart/table shows a
   local placeholder and recovers when the input is corrected.

Additional guarantees:

- Source/data budgets abort pathological programs with a "split this UI block" hint.
- Charts and maps validate numeric inputs and never emit `NaN`/`Infinity` geometry.
- Diagnostics are collapsed, selectable and copyable; at most 100 items are shown.
- Copy helpers own one timer, handle clipboard rejection and unmount races.
- Playback timers are cleared on unmount.
- The renderer keeps no per-message global cache; the syntax-highlight rule cache is bounded by
  the fixed language list.

## Prompt architecture

Two independently iterable runtime-context modules, injected by the host half:

| Module               | Name                                      | Order | Purpose                                                                                                                      |
| -------------------- | ----------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------- |
| Presentation policy  | `dsh-intelligence-ui:presentation-policy` |   100 | Content-first presentation strategy: when to use prose vs. UI blocks, adaptive composition, restraint, accuracy, self-check. |
| Capability reference | `dsh-intelligence-ui:capability`          |   150 | Component signatures, value domains, syntax rules, and the "visual restraint" quality bar.                                   |

Both use `systemPrompt.context`, so the host system message stays clean. Changing policy does not
touch component documentation, and vice versa. The policy module never mentions fence syntax; the
capability module is the only place that defines it.

## Design system

Visual rules live in `src/ui/theme.js` and are enforced by tests:

- every colour/type/radius is a host theme token (`--dsw-*` / `--dsh-*`);
- light and dark themes are automatic — no component branches on the theme;
- data uses the host's business-blue accent, not the monochrome brand colour;
- status text uses `INK.*` (semantic colour mixed with ink) so tinted backgrounds keep readable
  contrast; dots/fills use the raw semantic tokens;
- static surfaces use hairlines and layered surfaces, not shadows.

See [`design.md`](design.md) for the token table and per-component guidance.

## Testing

| Layer              | Suites                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Parser / evaluator | `corpus-test` (56 synthetic programs), `compiler-test`, `adversarial-test`                                                |
| Renderer           | `smoke`, `theme-test`, `token-test`, `chart-test`, `budget-test`                                                          |
| Real browser       | `browser-test` (DOM lifecycle, fault isolation, heap), `interact-test` (chart/map interactions), `measure` (design gates) |
| Host side          | `prompt-test` (module structure, coverage, responsibilities)                                                              |

The design gate runs in headless Chrome and measures computed styles rather than screenshots:
no gradients on static surfaces, no shadows, no uppercase labels, no horizontal overflow, a
bounded type scale, one-off entrance animation, heading line limits, body-text contrast and a
bounded accent-hue count. Counts and commands are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Security & privacy

- No network calls, no analytics, no telemetry.
- Model output is rendered through React elements — never `innerHTML`; links are host-handled.
- Clipboard writes are user-initiated and failure-tolerant.
- Upstream `@openuidev/lang-core` telemetry is disabled by default (see `SECURITY.md`).

## Compatibility

- Client: browser platform modules provided by DSH (React — host-provided; the repository's test
  dependencies build against React 19, slots, primitives, store).
- Host: plain ESM, no build.
- Node for building/tests: `>= 20`.
- Committed build artifact: `lib/client.js` (DSH installs the plugin directory as a bundle, so the
  prebuilt artifact is part of the deliverable; CI verifies the bundle budget).
