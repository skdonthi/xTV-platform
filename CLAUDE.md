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
| `docs/` | `signing.md` (manual signing), `config-hot-reload.md` (live config, no reboot), `theming.md` (config-driven themes), `state-and-storage.md` (state layers + persistence), `tv-platform-reference.md` (keycodes + device APIs), `DEV-PLAYBOOK.md` (skills/workflow). |
| `signing/` | `signing.example.json` (template). Real creds in gitignored `.signing.local.json`. |

### Key libs
`core` (bootstrap/composition root + the root Blits `App` in `src/app.ts`) ·
`widgets` (**Blits content components** + the `CONTENT_WIDGETS` registry — the
render path) · `runtime-config` (tenant config loader + remote override) ·
`navigation` (per-platform keymaps → Blits input via `toBlitsKeymap`) · `muting`
(audio muting, ports & adapters) · `service-gateway` + `integrations/*` (backend
adapters: xmm, liferay, remote-control) · `websocket` · `diagnostics` (overlay,
PIN-gated) · `player` (ports & adapters: avplay+DRM / Android bridge / HTML5) ·
`feature-flags` · `themes` · `i18n` · `storage` (persistence + Blits appState) ·
`layout` (DOM `CustomerLayout` TYPE only — not the render path; see decision 8).

## Bootstrap flow (`libs/core/src/index.ts`)

1. `createRuntimeConfigLoader().load()` — imports the **one** bundled tenant
   config, fetches the head-end override, deep-merges.
2. `service-gateway` resolves the active layout (local, or head-end xmm/liferay);
   `setBootConfig()` snapshots the resolved config for the Blits app to read via
   `getBootConfig()`.
3. Build device info + diagnostics overlay; **mount diagnostics BEFORE launch** so
   on-device errors surface even if Blits fails.
4. Register the Blits `appState` plugin (seeded from config), then
   `Blits.Launch(App, "app", { fonts, keymap, … })` mounts the root Application
   (`libs/core/src/app.ts`).
5. `connectLiveConfig()` — on `config.updated` ws push: re-pull config + layout,
   `setBootConfig()`, dispatch `xtv:config-updated`; the app re-derives its
   reactive state **in place, no reload** (decision 3). Reload = fallback only.
6. `connectMuting()` — if `audioMuting` flag + `mutingService` URL, wire the muting
   controller (`audio.mute` → full-screen announcement overlay).

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
3. **Config apply = reload (on device).** Head-end pushes `{type:"config.updated"}`
   → core `location.reload()` → boot re-pulls config + layout → new theme/layout/
   endpoints. This is the proven path ("worked like a charm" on the TV). The
   in-place reactive hot-apply (`app.ts` `deriveUi()` + `hooks.ready` listening for
   a `xtv:config-updated` event, with colon-bound reactive attrs) **works in the dev
   browser but NOT on the Tizen renderer** — state re-derived but the canvas didn't
   repaint on-device — so it's dormant (kept for boot + future once we can debug
   on-device). config fetch is cache-busted so reload always gets fresh config.
   Full mechanism: `docs/config-hot-reload.md`.
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
8. **UI render layer = Blits** (`@lightningjs/blits`, LightningJS canvas).
   `Blits.Launch(App, "app", …)` mounts the root Application (`libs/core/src/app.ts`)
   = the **guest portal**: a persistent side-nav (Home/Movies/…) + content widgets.
   The **root App owns the D-pad** — two-column focus (nav column ⇄ content column;
   up/down within the focused column, left/right cross, enter switches/plays) with
   **no child focus** (input stays on the default-focused root). Widgets are Blits
   components (`libs/widgets/src/components/*.component.ts`). Content is config-driven
   via `home.json` + the widget registry (decision 11). The old DOM
   `layout`/`widget-registry` path is retained **only** to feed the `CustomerLayout`
   type — not the render path.
9. **State & storage.** Local/UI state = Blits component `state()`. Global reactive
   state = Blits `appState` plugin (registered in core, seeded from config; read via
   `this.$appState`). Persistence = `@x-tv/storage` `createStorage(namespace)` — a
   namespaced (`xtv.<ns>.`) wrapper over Blits' storage plugin with an in-memory
   fallback, safe to import ANYWHERE (bootstrap, libs, components). **Durable state
   (guest prefs, entitlements, resume points) lives on the head-end** via
   service-gateway — localStorage is best-effort only (TV quota; wiped on
   update/uninstall). zustand was removed (unused; Blits covers reactive state).
   Full model: `docs/state-and-storage.md`.
10. **Release version is build-time, not runtime.** Each cruiseline's version lives
    in `customers/<line>/release.json` (engineering-owned; gradle-style versionName,
    versionCode derived) — baked into the artifact (config.xml/appinfo version, `.wgt`
    name, Android versionCode). **NOT** in `config.json` (that's deployment/head-end-
    owned + runtime-overridable). Packager precedence: `--version` > `XTV_APP_VERSION`
    (CI) > `release.json` > root `package.json`. Don't pass `--version` through
    `nx build` — nx swallows it; use `XTV_APP_VERSION` for CI.
11. **Config-driven portal = widget registry + `home.json`.** `libs/widgets` exports
    `CONTENT_WIDGETS` (widget name → Blits component) — the per-build registry.
    `customers/<line>/layouts/home.json` describes the portal: `root.children` are
    `widget` nodes `{ widget, label, feature?, dataSource? }`. The App (`deriveUi` /
    `buildSections` in `app.ts`) keeps nodes whose `widget` is in the registry AND
    whose `feature` gate passes, then builds the side-nav + routes from them. So a
    tenant/head-end controls **which** of the build's widgets appear, their **order,
    labels, feature-gating, and data source** — all from config, no code.
    `node.dataSource` = a full URL **or** a key into `config.services` (endpoints
    stay in `config.json`; layout references by name); omitted → `<widget>Url`.
    **Blits CEILING (why it's not fully data-driven):** Blits **precompiles the
    `template` at build** (must be a static string literal — no runtime-generated
    tags), component tags must be **Capitalized**, `<Component is>` resolves **once**
    (not reactive), and the Blits **Router auto-focuses pages** (fights the
    persistent nav). So a **new widget TYPE** needs: a Blits component + a
    `CONTENT_WIDGETS` entry + a **static `<Tag :show=…>` line** in `app.ts` template
    + a `home.json` reference. Config selects/orders/gates among build-listed
    widgets; it cannot introduce new types.
12. **Player = ports & adapters** (`libs/player`). `createPlayerAdapter(platform)` →
    avplay (Samsung) / Android bridge / HTML5 (webOS + dev). Enter on a movie card
    plays its stream, Back stops. **PROIDIOM DRM** (Samsung): avplay handshake
    `open → setDrm("PROIDIOM","Initialize",…) → prepare → play` (ported from legacy
    CCL), plus the `.MPG→.mpg` Tizen quirk. avplay draws on a **hardware plane behind
    the Blits canvas** → on play we hide the canvas + make the page transparent so
    video shows (`showVideoPlane`), restored on stop. LYNK DRM = follow-up (needs a
    key-server in config). Encryption flows movie payload → `PlayEntry.drm` →
    appState → App → `player.load(url, drm)`.
13. **Fonts = build-time brand asset, NOT head-end config.** `customers/<line>/
    fonts.json` via the `@x-tv/tenant/fonts` alias (same pattern as config/layout).
    MSDF atlases for canvas text — CSS/`@font-face` never applies to the WebGL
    canvas. Not runtime-overridable (like `release.json`).
14. **Old-TV transpile floor.** All three app `vite.config.ts` set `build.target`
    **and** `esbuild.target` `"chrome76"` (Tizen 6.5 = Chromium M76). Without it the
    bundle ships `??`/`?.`/`??=` untranspiled → M76 parse-error → **blank screen**.
    `apps/<p>-tv/src/polyfills.ts` (Array/String `.at`, String `.replaceAll`) is
    imported **first** in each `main.ts` for vendored code. Residual modern syntax
    survives only inside Blits' runtime-codegen strings (`new Function`'d) — the
    suspect if the oldest panels still blank after this.

## How to…

- **Add a cruiseline:** create `customers/<slug>/config.json` + `layouts/home.json`
  + `fonts.json` (+ `assets/`, `i18n/`, `release.json`); add its head-end alias to
  `tools/packaging/customer-slug.mjs` only. Build: `nx build samsung --customer=<slug>`.
  (Figma design → `home.json` sections + widget props + theme tokens.)
- **Add a content widget (NEW type):** (1) write `libs/widgets/src/components/
  <name>.component.ts` (Blits, props for the superset the App passes: `active`,
  `focusIndex`/`railFocus`/`colFocus`, `url`, theme colors); (2) add it to
  `CONTENT_WIDGETS` in `libs/widgets/src/index.ts`; (3) add a **static**
  `<Name :show="$show…" …>` tag to the `app.ts` template + its show/url wiring
  (Blits templates are precompiled — no dynamic tags, see decision 11); (4)
  reference `{ widget:"<name>", label, dataSource?, feature? }` in a tenant's
  `home.json`. Steps 1-3 are engineering; step 4 is per-tenant config.
- **Change the portal without a rebuild:** edit the tenant's `home.json` (reorder /
  relabel / feature-gate / repoint `dataSource`) or `config.json` (theme, endpoints)
  on the head-end and push `config.updated` — the app hot-applies (decision 3). No
  new widget types this way (those need a build).
- **Add a platform:** new `apps/<p>-tv/` shell (+ `polyfills.ts`, `public/.gitkeep`,
  `build.target` in `vite.config.ts`), `platforms/<p>/{profiles,templates}`, a
  packager branch in `tools/packaging/package-tv.mjs`, and platform adapters
  (player in `libs/player`, audio in `libs/muting`, keymap base in `libs/navigation`).
- **Sign:** see `docs/signing.md`. Build + sign one Samsung `.wgt`:
  `XTV_CCL_TIZEN_PROFILE=<cert-profile> npm run build:samsung -- --customer=ccl --sssp=<ver>`
  (bump `--sssp` to force URL-Launcher re-download). Artifacts land in
  `dist/platforms/samsung/ccl/tizen6/artifacts/` (`.wgt` + `sssp_config.xml`).

## Gotchas / carry-forward warnings

- **Tizen CSP** strips inline `<script>`/`<style>` → blank screen on device. The
  permissive `<tizen:content-security-policy>` in `platforms/samsung/templates/config.xml`
  is mandatory. (Learned the hard way on the legacy CCL app.)
- **Tizen emulator does not run on Apple Silicon** — verify Samsung on real hardware.
- **Samsung `$B2BAPIS`/avplay** may need the MDC/B2B install channel even with a
  partner cert; signing alone doesn't grant it.
- **Samsung dev/partner cert is DUID-LOCKED.** `ccl-dev-blits-samsung` runs only on
  TVs whose DUID is registered in the Samsung Certificate. A build that works on the
  dev TV (HG32F800) will **blank / refuse** on other sets — including other Tizen 9
  models — until their DUIDs are added, or a fleet distributor cert (LYNK/Pro:Centric
  partner, not DUID-locked) is used. **Rule out the cert before chasing a code bug**
  when "works on one TV, blank on others (same Tizen version)."
- **Blits `:attr` is reactive, plain `attr="$x"` is NOT.** `:attr="$x"` compiles to
  an effect that re-runs on change (`generator.js`); plain `attr="$x"` is
  interpolated **once at mount**. So anything that must update live (theme colors,
  data URLs, any hot-applied value) MUST use the colon — including App→child prop
  bindings. Missing colons = "state changed but the screen didn't" (how the first
  hot-apply theme/webservice change silently failed). Data widgets also need a
  `watch(url)` to re-fetch when their endpoint changes.
- **Blits templates are PRECOMPILED at build** (`vite/preCompiler`) — the `template:`
  value must be a static string literal. No runtime-generated/interpolated tags;
  component tags must be **Capitalized**; `<Component is="$x">` resolves once (not
  reactive). See decision 11.
- **avplay video is behind the canvas.** On Tizen the movie plays on a hardware plane
  under the Blits WebGL canvas; the canvas must be hidden/transparent while playing
  or the movie is invisible (`showVideoPlane` in `libs/player`).
- **Old TV web engines** (Tizen 6.5 = M76) need `build.target: chrome76` +
  `polyfills.ts` (decision 14). Residual `?.` inside Blits' `new Function` codegen
  strings can still trip the very oldest engines — the last suspect after the cert.
- **Android native bridge** (`globalThis.xtvAndroid`) is a TODO — the muting audio
  adapter and diagnostics device-info no-op on Android until the Kotlin
  `@JavascriptInterface` bridge is built.
- **LG/Android per-cruiseline certs** are procurement-pending; the pluggable design
  keeps builds green meanwhile.
- On this dev Mac: `tizen` + `ares-package` are installed, `gradle` is not.
- **Blits build quirks:** (a) never put `.blits.` in a `.ts` filename — the Blits
  Vite converter treats the import as a `.blits` SFC and fails; name Blits component
  files `*.component.ts`. (b) each `apps/<p>-tv/` needs a `public/` dir (Blits'
  msdfGenerator scans it) — keep the `.gitkeep`. (c) Blits' Vite plugin is the
  **default array export** of `@lightningjs/blits/vite` — spread it: `plugins: [...blits]`.
- **Tizen firmware SDK is runtime-injected**, not a static `index.html` tag —
  `apps/samsung-tv/src/main.ts` appends the `$WEBAPIS/$B2BAPIS` scripts before
  bootstrap (static tags can't be bundled by Vite). Guarded adapters fall back if
  absent.
- **Platform SDK globals are firmware-provided, not vendored.** `apps/samsung-tv/index.html`
  loads Tizen `webapis.js` / `avplayextension.js` / `b2bapis.js` via `$WEBAPIS`/`$B2BAPIS`
  script tags (resolved on-device; 404 harmlessly in a browser). LG uses the
  firmware `hcap` global (no webOSTV.js). Android uses the native `xtvAndroid`
  bridge. Adapters (`libs/muting`, `libs/player`) guard these globals and fall
  back to HTML5/local, so dev never breaks.

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
