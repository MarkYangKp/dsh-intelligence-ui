# Agent guide

This file is for AI coding agents working in this repository. Keep it short, factual and current.

## Project in one paragraph

`dsh-intelligence-ui` is a two-half DeepSeek Harness plugin. The host half (`index.js`) injects two
runtime prompt modules; the browser half (`src/` → committed `lib/client.js`) registers the
`assistant-step` renderer and renders OpenUI programs / compiled Markdown into 44 theme-native React
components. OpenUI Lang parsing/evaluation comes from `@openuidev/lang-core`.

## Commands

```bash
pnpm install
pnpm build                 # src/ → lib/client.js  (must be rebuilt in the same commit)
pnpm test                  # build + unit/browser suites (310 checks; browser suites skip without Chrome)
pnpm test:unit             # the same suites without browser tests (no Chrome needed)
pnpm test:design           # computed-style design gates (36 checks, headless Chrome)
pnpm test:interact         # chart/map interaction regressions (10 checks)
pnpm test:docs             # relative Markdown links must exist AND be tracked by git
pnpm format                # Prettier; format:check is a CI gate
pnpm shot                  # regenerate docs/gallery* + docs/gallery.html
pnpm preview -- --name me --only "图表" --theme both
```

## Invariants — do not break them

1. **OpenUI program schema is frozen**: `defineComponent` props/zod/order/descriptions must not
   change. `test/budget-test.mjs` holds a schema fingerprint; if a schema change is intentional,
   update the fingerprint, the capability prompt in `index.js`, `docs/COMPONENTS.md` and
   `CHANGELOG.md` in the same change.
2. **Committed build output**: `lib/client.js` is committed on purpose (DSH installs a directory as
   a bundle). Rebuild it when `src/` changes; CI fails if the tree drifts.
3. **Token-only styling**: no hard-coded colours, no gradients, no uppercase micro-labels, no font
   sizes outside `FS.*`. Light/dark and 390/920px must both work. `test/theme-test.mjs`,
   `test/token-test.mjs` and `test:design` guard this.
4. **No private data**: never commit secrets, personal paths, private hosts, extracted host theme
   values, or conversation-derived content. The test corpus must stay synthetic and de-identified.
5. **Host theme values are not redistributed**: `test/fixtures/dsh-theme.css` is generated locally
   and git-ignored; use `test/fixtures/theme-fallback.css` for offline tests.
6. **Docs stay in sync**: update `README*`, `docs/` and `CHANGELOG.md` when behaviour or public API
   changes. Run `pnpm test:docs` and `pnpm format:check`.
7. **Public `main` is canonical**: the public GitHub history is the source of truth; the old
   `private-history` branch is never pushed. See `RELEASING.md`.

## Where things live

- `index.js` — host halves: presentation policy + capability prompt modules.
- `src/client.jsx` — renderer registration, fence splitting, message isolation, UI CSS.
- `src/openui-runtime.jsx` — pipeline, tolerant argument binding, library assembly.
- `src/ui/theme.js` — design tokens; `src/ui/shared.jsx` — shared atoms.
- `src/ui/*.jsx` — one module per component group.
- `src/compiler.mjs` — Markdown → OpenUI compiler (pure, zero deps).
- `docs/` — component reference, architecture, design rationale.
- `test/` — suites above; `test/corpus/` is a synthetic regression corpus.
