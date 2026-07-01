# CLAUDE.md — xTV Platform

Guidance for Claude Code (and humans) working in this repo. Read this first.

## What this is

A configurable **LightningJS Smart-TV runtime** that builds **one shared app**
into signed, production-deployable apps for **Samsung Tizen** (`.wgt`),
**LG webOS** (`.ipk`) and **Android TV** (`.apk`). Distribution model is
**hospitality sideload** (Samsung SSSP/URL-Launcher, LG Pro:Centric, Android
sideload/MDM) — no app-store review.

**CCL (Carnival) is the current production tenant.** The repo keeps a
cruiseline × platform build matrix so other cruiselines (AIDA, RCCL, Disney) can
be onboarded later, but only CCL is populated today.

## The two axes (core mental model)

```
                 PLATFORM →   samsung(tizen)   lg(webos)   android-tv
CRUISELINE ↓                  ─────────────────────────────────────────
  ccl                         CCL.wgt          CCL.ipk     CCL.apk
```

- **Cruiseline axis** (tenant) — owns API endpoints, websocket URLs, remote
  keymap, theme, brand assets, app identity, and its own signing certs. Lives in
  `customers/<slug>/`.
- **Platform axis** (container) — owns the package format, signing mechanics,
  native player. Lives in `platforms/<platform>/`.

A build is one **cell**: `nx build samsung --customer=ccl --profile=tizen6`.

## Repo layout

| Dir | What it is |
|---|---|
| `apps/<platform>-tv/` | Thin bootstrap shells (~7 lines) — `main.ts` calls `bootstrapTvPlatform()`. Also the platform's `vite.config.ts`. **No business logic.** |
| `libs/` | All shared app code (TypeScript). See below. |
| `platforms/<platform>/` | Packaging inputs: `profiles/*.json` (capabilities) + `templates/` (container manifests). **Not app code.** |
| `customers/<slug>/` | Per-cruiseline content: `config.json` (sectioned), `layouts/`, `i18n/`, `assets/`. |
| `tools/` | Build tooling: `executors/build-tv.mjs`, `packaging/` (package-tv, signing, customer-slug), `vite/xtv-aliases.ts`. |
| `docs/` | `signing.md` (manual signing), `config-hot-reload.md` (live config, no reboot), `DEV-PLAYBOOK.md` (skills/workflow). |
| `signing/` | `signing.example.json` (template). Real creds in gitignored `.signing.local.json`. |

### Key libs
`core` (bootstrap/composition root) · `runtime-config` (tenant config loader +
remote override) · `layout` (server-driven layout + renderer) · `widget-registry`
· `navigation` (keymap → `xtv:action`) · `muting` (audio muting, ports & adapters)
· `service-gateway` + `integrations/*` (backend adapters: xmm, liferay,
remote-control) · `websocket` · `diagnostics` (overlay) · `player` (stub) ·
`feature-flags` · `themes` · `i18n`.

## Bootstrap flow (`libs/core/src/index.ts`)

1. `createRuntimeConfigLoader().load()` — imports the **one** bundled tenant
   config, fetches the head-end override, deep-merges.
2. Build device info + diagnostics overlay.
3. `applyAndRender(config)` — service gateway → active layout → render `#app` →
   attach navigation. **Re-callable** for hot config apply.
4. `connectLiveConfig()` — on `config.updated` ws push, re-pull + re-apply (no reboot).
5. `connectMuting()` — if `audioMuting` flag + `mutingService` URL, wire the muting controller.

## Commands

```bash
npm run dev:samsung            # vite dev server (also dev:lg / dev:android)
npm run build:samsung          # build + package one platform (defaults to ccl)
npm run build:ccl              # all three platforms for ccl
npm run package:samsung        # re-package an existing web build
npm test                       # vitest run
npm run typecheck              # tsc --noEmit
npm run lint / npm run format  # biome
```
Sign a build by exporting `XTV_CCL_*` env (see `docs/signing.md`) before `build`.

## Key decisions (and why)

1. **Single sectioned `customers/<slug>/config.json`** (`runtime` / `integrations`
   / `identity` / `keymap`). One file per tenant; layouts + i18n stay as folders.
2. **Head-end config override** — bundled config is the fallback; at boot the app
   fetches `integrations.configUrl` and deep-merges it on top. Config changes ship
   **without a rebuild**. Fetch fails → bundled defaults.
3. **Hot reload, no TV reboot** — head-end pushes `{type:"config.updated"}` on the
   tenant websocket → re-pull + re-render in place. Soft `location.reload()` fallback.
   (Keymap changes currently need the soft reload; layout/theme/features/endpoints
   apply hot.) Full mechanism: `docs/config-hot-reload.md`.
4. **Per-brand isolation (GDPR) — CRITICAL.** Each build compiles in **exactly one**
   tenant. The slug is resolved **build-time only** (`tools/packaging/customer-slug.mjs`,
   never bundled); Vite aliases `@x-tv/tenant/{config,layout}` to that one tenant's
   files; `runtime-config` statically imports `@x-tv/tenant/*`.
   **NEVER** reintroduce `import.meta.glob("customers/*")` or a `customerAliases`
   map in shipped `libs/` code — that leaks rival brand names/endpoints into a
   brand's signed artifact. Verified: a build contains zero other-tenant tokens.
5. **Cert-pluggable signing** — keyed `(cruiseline, platform)`, resolved from env or
   gitignored local file; unsigned + loud warning when absent, build stays green.
6. **Vite `base: "./"`** on all apps — relative asset URLs so the bundle resolves
   under `file://` (Tizen/webOS widget root, Android asset). LightningJS analog of
   the legacy CCL `XC_WEB_ROOT` fix.
7. **Ports & adapters** for platform capabilities (see `libs/muting`): a
   platform-agnostic controller depends on an interface; each platform supplies an
   adapter. Add a platform = new adapter, controller untouched.

## How to…

- **Add a cruiseline:** create `customers/<slug>/config.json` + `layouts/home.json`
  (+ `assets/`, `i18n/`); add its head-end alias to `tools/packaging/customer-slug.mjs`
  only. Build: `nx build samsung --customer=<slug>`.
- **Add a widget:** register in `libs/widget-registry`, reference it in the tenant's
  `layouts/home.json`, optionally gate with `node.feature` + a flag.
- **Add a platform:** new `apps/<p>-tv/` shell, `platforms/<p>/{profiles,templates}`,
  a packager branch in `tools/packaging/package-tv.mjs`, and platform adapters
  (audio, keymap base in `libs/navigation`).
- **Sign:** see `docs/signing.md`.

## Gotchas / carry-forward warnings

- **Tizen CSP** strips inline `<script>`/`<style>` → blank screen on device. The
  permissive `<tizen:content-security-policy>` in `platforms/samsung/templates/config.xml`
  is mandatory. (Learned the hard way on the legacy CCL app.)
- **Tizen emulator does not run on Apple Silicon** — verify Samsung on real hardware.
- **Samsung `$B2BAPIS`/avplay** may need the MDC/B2B install channel even with a
  partner cert; signing alone doesn't grant it.
- **Android native bridge** (`globalThis.xtvAndroid`) is a TODO — the muting audio
  adapter and diagnostics device-info no-op on Android until the Kotlin
  `@JavascriptInterface` bridge is built.
- **LG/Android per-cruiseline certs** are procurement-pending; the pluggable design
  keeps builds green meanwhile.
- On this dev Mac: `tizen` + `ares-package` are installed, `gradle` is not.

## Development workflow

Follow `docs/DEV-PLAYBOOK.md` — it lists the skills/tools (security-review,
Design/frontend-design for Hospitality TVs, ui-ux-pro-max, ponytail review/audit,
Chrome DevTools, Blits example app reference) and a paste-ready kickoff prompt.

## Conventions

- TypeScript throughout; Biome for lint/format (2-space, double quotes).
- Libraries referenced via `@x-tv/*` aliases (see `tools/vite/xtv-aliases.ts` and
  `tsconfig.base.json` paths — keep them in sync).
- Tests are `libs/**/*.test.ts`, run with vitest, node environment.
- Never commit signing secrets.
