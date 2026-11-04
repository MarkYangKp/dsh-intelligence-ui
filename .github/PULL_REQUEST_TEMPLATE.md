## What changed

<!-- One or two sentences on the user-visible effect. -->

## Type

- [ ] Bug fix
- [ ] New component / prop
- [ ] Visual / design-system change (include screenshots)
- [ ] Prompt / compiler change
- [ ] Tooling / tests / docs only

## Checklist

- [ ] `pnpm test` passes (and `pnpm test:design` + `pnpm test:interact` for visual changes)
- [ ] `lib/client.js` rebuilt when `src/` changed (`pnpm build`)
- [ ] OpenUI program schema unchanged — or the fingerprint in `test/budget-test.mjs`, the
      capability prompt in `index.js`, and `docs/COMPONENTS.md` are updated together
- [ ] No hard-coded colours, no theme-token names that do not exist (`test/token-test.mjs`)
- [ ] No secrets, personal paths, private hosts, or conversation-derived content
- [ ] Docs updated (`README`, `docs/`, `CHANGELOG.md`) when behaviour or API changed

## Screenshots (visual changes)

| Light | Dark |
| ----- | ---- |
|       |      |
