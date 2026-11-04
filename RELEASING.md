# Releasing

## Model

The **public GitHub repository is the canonical history**. Development happens on `main`; releases
are Git tags on `main` plus a GitHub release. This repository is a plugin distributed as a
directory bundle, so there is no npm publication step.

The pre-publication local history (early experiments, private context) is preserved only in a
local `private-history` branch and is **never pushed to the public remote**.

## One-time initial publication

Prerequisites: a clean work tree, the full test suite green, and `lib/client.js` in sync with
`src/`.

1. Create an **empty** GitHub repository (no README, license, or `.gitignore`).
2. Add the remote and push the prepared single-commit `main`:

   ```bash
   git remote add github git@github.com:MarkYangKp/dsh-intelligence-ui.git
   git push github main --tags
   ```

3. In the repository settings, enable:
   - **Pages** → Source: **GitHub Actions** (the `pages` workflow publishes `docs/`);
   - **Security** → **Private vulnerability reporting**;
   - branch protection for `main` (require the `ci` checks, no direct pushes);
   - Description, topics (`deepseek-harness`, `dsh`, `dsh-plugin`, `openui`, `generative-ui`),
     social preview image (`docs/hero.png`), and Discussions if desired.
4. Point local `main` at the public remote and remove/rename any private remote:

   ```bash
   git branch --set-upstream-to=github/main main
   git remote rename origin gitea   # optional: keep the old archive remote, never push history to it
   ```

## Regular release

1. Move `Unreleased` entries in `CHANGELOG.md` into a dated `## [x.y.z] — YYYY-MM-DD` section.
2. Bump `version` in `package.json`, the console marker documented in `README.md`, and any version
   strings in docs.
3. `pnpm install && pnpm build && pnpm test && pnpm test:design && pnpm test:interact`
4. `pnpm test:docs && pnpm format:check && git diff --exit-code lib/client.js`
5. Commit on `main`, tag, and push:

   ```bash
   git commit -am "release: vx.y.z"
   git tag -a vx.y.z -m "vx.y.z"
   git push github main --follow-tags
   ```

6. Create the GitHub release from the tag, pasting the matching `CHANGELOG.md` section. GitHub
   Pages redeploys automatically from `main`.

## Hotfixes

Branch from `main`, fix, open a PR (the `ci` workflow must be green), merge, then cut a patch
release following the steps above.

## What not to do

- Never push `private-history` (or old private tags) to the public remote.
- Never force-push `main` after the initial publication; contributions would be lost.
- Never publish `lib/client.js` without rebuilding it from `src/`.
