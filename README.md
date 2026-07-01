# xTV-platform

A configurable **LightningJS Smart-TV runtime**. Write the app once; build it
into **signed, production-deployable** apps for **Samsung Tizen** (`.wgt`),
**LG webOS** (`.ipk`) and **Android TV** (`.apk`). Nx monorepo — TypeScript,
Vite, i18next; hospitality-sideload distribution (no app-store review).

This is not a traditional web app. `apps/` are thin bootstrap/packaging shells;
product behavior lives in `libs/` and per-cruiseline config lives in `customers/`.

> **New here?** Read [CLAUDE.md](CLAUDE.md) — architecture, decisions, and how-tos.

## The build matrix

Builds fan out along two axes — **cruiseline × platform**:

```
                 PLATFORM →   samsung(tizen)   lg(webos)   android-tv
CRUISELINE ↓                  ─────────────────────────────────────────
  ccl  (production)           CCL.wgt          CCL.ipk     CCL.apk
```

**CCL (Carnival)** is the current production tenant. The matrix stays in place so
AIDA / RCCL / Disney can be onboarded later; each build compiles in exactly **one**
tenant (per-brand isolation — see below).

## Workspace

```txt
apps/<platform>-tv/     Thin bootstrap shells + each platform's vite.config
libs/                   All shared app code (see CLAUDE.md for the full list)
platforms/<platform>/   profiles/*.json (capabilities) + templates/ (manifests)
customers/<slug>/       config.json (sectioned) + layouts/ + i18n/ + assets/
tools/                  build-tv, package-tv, signing, customer-slug, vite aliases
docs/                   signing.md, DEV-PLAYBOOK.md
signing/                signing.example.json (real creds gitignored)
```

## Commands

```sh
npm install
npm run dev:samsung            # vite dev server (also dev:lg / dev:android)
npm run build:samsung          # build + package one platform (defaults to ccl)
npm run build:ccl              # all three platforms for ccl
npm run package:samsung        # re-package an existing web build
npm test                       # vitest
npm run typecheck              # tsc --noEmit
npm run lint  /  npm run format
```

Select a cell explicitly: `nx build samsung --customer=ccl --profile=tizen6`.
Output: web bundle in `dist/apps/<platform>-tv`, packaged artifact in
`dist/platforms/<platform>/<customer>/<profile>/artifacts`.

Expose the dev server to a physical TV on your LAN:
```sh
XTV_DEV_HOST=0.0.0.0 npm run dev:samsung
```

## Signing

Signing is **cert-pluggable**, keyed `(cruiseline, platform)`. Provide credentials
via `XTV_<LINE>_*` env vars or a gitignored `signing/.signing.local.json`; with
none set, the build emits an **unsigned** artifact plus a loud warning (build
stays green). Full manual + automated instructions: **[docs/signing.md](docs/signing.md)**.

```sh
export XTV_CCL_TIZEN_PROFILE=ccl-dev-2
npm run build:samsung          # → signed CCL.wgt + sssp_config.xml
```

## Config, remote override & live reload

Each tenant has one sectioned `customers/<slug>/config.json` (`runtime` /
`integrations` / `identity` / `keymap`). At boot the app fetches
`integrations.configUrl` from the head-end and **deep-merges it over** the bundled
config — so config changes ship **without a rebuild**. A `{"type":"config.updated"}`
websocket push triggers a **hot re-apply** (re-render in place, no TV reboot; soft
reload fallback).

New behavior ships config-first: register a widget in `libs/widget-registry`,
reference it in the tenant layout (`node.feature` gates it by flag), deliver config.
Only genuinely new widget **code** needs a new build.

## Per-brand isolation (GDPR)

Every build compiles in **exactly one** cruiseline. The slug is resolved
**build-time only** (`tools/packaging/customer-slug.mjs`, never bundled); Vite
aliases `@x-tv/tenant/*` to that one tenant's files. A CCL bundle contains **zero**
tokens from any other brand. **Never** reintroduce `import.meta.glob("customers/*")`
or a tenant alias map in shipped `libs/` — that leaks rival brands into an artifact.

## TV diagnostics

The runtime mounts a diagnostics overlay (platform, profile, customer, device
info) and mirrors `console.*`. Unlock the console with the remote numeric PIN
(demo PIN `2580`, entered within the timeout), or developer shortcuts (`F2`, `D`,
`Info`, Samsung `ColorF0Red`) when enabled. Native tools still apply: Samsung
Remote Web Inspector, LG Web Inspector, Android `adb logcat`.

## Import patterns & boundaries

Reference shared code via `@x-tv/*` aliases; export public contracts from each lib's
`src/index.ts`, no deep imports. Apps depend on `@x-tv/core` only. `core` composes
libraries without business logic. Backend adapters live in `libs/integrations/*` and
are consumed through `@x-tv/service-gateway`, never directly by widgets or apps.

## Development workflow

See **[docs/DEV-PLAYBOOK.md](docs/DEV-PLAYBOOK.md)** — the skills/tools to use
(security-review, Design/frontend-design for Hospitality TVs, ui-ux-pro-max,
ponytail review/audit, Chrome DevTools, the Blits example app) and a paste-ready
kickoff prompt.
