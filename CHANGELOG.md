# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-11-04

The first public release of the plugin; this entry also covers the repository work done while
preparing for publication.

### Added

- **Design system v3 ("Precision Editorial")**: token-only visual language on top of the host
  theme (`src/ui/theme.js`), shared visual atoms (`src/ui/shared.jsx`), a 7-step type scale,
  semantic ink colours for status text, and a 7-colour data palette.
- **Docs**: `docs/COMPONENTS.md` (all 44 component signatures and program syntax),
  `docs/ARCHITECTURE.md` (pipeline, modules, robustness, prompt architecture),
  `docs/design.md` (tokens and per-component visual guidance), plus a documentation index.
- **New tools**: `pnpm preview` (isolated-bundle visual preview), `pnpm shot` (regenerate the
  gallery), `scripts/deploy.mjs` (maintainer deploy helper), `scripts/extract-theme.mjs`
  (optional host-theme snapshot for pixel-accurate local previews), and a local Markdown link
  checker used by CI.
- **New gates**: theme-token existence (`test/token-test.mjs`), body-text contrast and accent-hue
  budget in the design gate, documentation link checking, and a CI check that the committed
  client bundle matches `src/`.
- **Project files**: English and Chinese READMEs, `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, issue/PR templates, Dependabot,
  CodeQL, CODEOWNERS, `.gitattributes`, `RELEASING.md`, `AGENTS.md`, and a documentation index.
- **Quality gates**: Prettier formatting check, Markdown link checker, and WCAG AA text-contrast
  gates (4.5:1 body, 3:1 large text) in both themes.
- Host prompt: complete component signatures plus a "visual restraint" guidance section.

### Changed

- All 44 components were rebuilt on the v3 design system: metric cards, tables, timelines, steps,
  charts, map, code/diff/file panels, tree/diagram views, containers and controls.
- The OpenUI runtime was split into focused modules under `src/ui/` (behaviour and public schema
  unchanged).
- Upgraded `@openuidev/lang-core` to `1.0.2`.
- Test corpus is a synthetic, de-identified regression corpus; all fixtures are
  environment-independent, and the design gate falls back to a self-authored theme approximation
  when no host-theme snapshot is available.
- Package metadata points at the public GitHub repository, pins `pnpm` via `packageManager`, and
  ships the example programs and maintenance scripts in the package.
- Install-time telemetry from the upstream language package is explicitly denied
  (`allowBuilds`), and CI sets `OPENUI_TELEMETRY_DISABLED` / `DO_NOT_TRACK`.

### Removed

- Internal development notes and private tooling files, the before/after comparison artefact, and
  `SKILL.md` (a bare `SKILL.md` inside an installed plugin package is never scanned by DSH's skill
  subsystem, so it only duplicated the capability prompt; the human-readable reference now lives
  in `docs/COMPONENTS.md`).
- Redistribution of extracted host theme styling: the theme snapshot is generated locally and
  git-ignored, while a self-authored approximation is used for offline tests and screenshots.

### Fixed

- Theme tokens that did not exist in the host theme (`--dsw-font-size-*`,
  `--dsw-font-family-code`) caused silent fallbacks; components now use the real tokens.
- Data visualisations rendered in near-monochrome because they used the host brand colour; they
  now use the host's business-blue accent.
- Code syntax-highlighting colours had insufficient contrast on light code backgrounds.
- A long-standing red smoke test caused by a missing external SlotCore extraction now uses a
  repository fixture with equivalent observable behaviour.
- Renderer defects from earlier rounds: message isolation on component failure, resource budgets
  for adversarial input, stable streaming identity, copy/timer cleanup, and Markdown compiler
  fallbacks.

## [1.0.0] — 2026-10

- First functional release: reply pipeline with native `openui` fences, automatic Markdown
  compilation, 44 components, host prompt modules, and the robustness layer.
