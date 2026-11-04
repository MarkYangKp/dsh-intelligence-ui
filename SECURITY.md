# Security policy

## Scope

This repository is a client-side plugin for DeepSeek Harness. It renders model-authored
OpenUI programs inside the chat window. The security-relevant surface is:

- the OpenUI program parser/evaluator and its resource budgets,
- the renderer's error isolation (a bad program must never break the conversation),
- syntax highlighting / diff rendering (no `innerHTML` from model output),
- clipboard copy helpers and playback timers.

## Reporting

Please **do not open a public issue** for a vulnerability. Use GitHub's
[private vulnerability reporting](https://github.com/MarkYangKp/dsh-intelligence-ui/security/advisories/new)
(enable it under Settings → Security when publishing the repository). Include reproduction steps
and the affected version. We aim to
acknowledge within a few days. If private reporting is temporarily unavailable, open a minimal
issue asking for a private channel without disclosing details.

## Telemetry

The plugin has no analytics, no network calls, and no telemetry. The bundled upstream
`@openuidev/lang-core` telemetry is disabled unless the host explicitly sets
`OPENUI_RUNTIME_TELEMETRY_ENABLED`; the browser runtime does not enable it, and this plugin
never sets it. Clipboard access is user-initiated only (copy buttons).

Install-time telemetry: `@openuidev/lang-core` ships a postinstall script that sends anonymous
installation telemetry (no source, prompts, paths or repository data) unless
`OPENUI_TELEMETRY_DISABLED=1` / `DO_NOT_TRACK=1` is set. This repository disables that script
explicitly in `pnpm-workspace.yaml` (`allowBuilds: '@openuidev/lang-core': false`), so
`pnpm install` here does not run it; CI also sets both environment variables. If you install the
dependency yourself outside this repository, set one of those variables to opt out.

Because the upstream package is bundled with `esbuild --minify`, its inert telemetry code path
(including a PostHog collection endpoint and the project's client-side key, both public
identifiers intended for browser use) is present in `lib/client.js` even though it cannot run in
the browser: the upstream runtime detection returns `undefined` for browser environments before
any network call. If you prefer a bundle without those code paths, vendor or patch
`@openuidev/lang-core` at build time; the plugin itself does not call them.

## Supported versions

Security fixes target the latest release on the `main` branch.
