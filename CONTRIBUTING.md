# Contributing

Thanks for taking a look. This is a plugin for **DeepSeek Harness (DSH)**, so the primary
requirement for anything beyond the unit tests is a DSH desktop installation that exposes the
plugin-bundle API.

## Development setup

```bash
git clone https://github.com/MarkYangKp/dsh-intelligence-ui.git
cd dsh-intelligence-ui
corepack enable && pnpm install   # Node >= 20, pnpm 12 (pinned via packageManager)
pnpm build          # writes lib/client.js (committed; CI checks it is up to date)
```

## Tests

```bash
pnpm test           # build + unit/browser suites (browser suites skip without Chrome)
pnpm test:unit      # same suites without browser tests (no Chrome needed)
pnpm test:design    # real-browser design gates: contrast, hue budget, overflow, ...
pnpm test:interact  # real-browser interaction regressions (charts, map expand)
pnpm test:docs      # relative Markdown links must exist and be tracked
pnpm format         # Prettier; use pnpm format:check to verify what CI verifies
pnpm shot           # regenerate the gallery screenshots in docs/
```

- `pnpm-workspace.yaml` denies `@openuidev/lang-core`'s install-time telemetry script; set
  `OPENUI_TELEMETRY_DISABLED=1` if you install that package elsewhere.
- Chrome is auto-detected (macOS/Linux/Windows paths, Playwright caches, `$CHROME`); set
  `CHROME=/path/to/chrome` if needed. On CI the suites run with `--no-sandbox` automatically.
- The design gate prefers a local snapshot of the host theme. Generate one with
  `node scripts/extract-theme.mjs` (optional; it falls back to an original approximation).
- If you are changing component visuals, use `pnpm preview -- --name me --only "图表" --theme both`
  for a fast isolated-bundle loop, and include light/dark + 920/390 checks in your PR.

## Pull requests

- Keep a PR focused: one concern per PR, and describe the user-visible effect (screenshots for
  visual changes).
- Do not change the OpenUI program schema (`defineComponent` props/zod) without updating the
  schema fingerprint in `test/budget-test.mjs`, the capability prompt in `index.js`, and the docs
  under `docs/` (including `docs/COMPONENTS.md`).
- Never commit secrets, private hostnames, personal paths, extracted host styling, or
  conversation-derived content. Tests must be reproducible from the repo alone.
- `lib/client.js` is committed on purpose (DSH installs a bundle from the directory); rebuild it
  (`pnpm build`) in the same PR when `src/` changes.
- Run `pnpm test` before pushing; visual changes should also run `pnpm test:design`.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). For security issues use
[SECURITY.md](SECURITY.md), not a public issue.

## Reporting issues

Please include the DSH version, the plugin version (console shows
`[dsh-intelligence-ui/x.y.z]`), the failing OpenUI program if applicable, and whether the
problem reproduces in the gallery (`docs/gallery.html`). For security-sensitive reports, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.
