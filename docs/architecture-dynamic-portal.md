# Architecture — Scalable, Config-Driven Guest-Experience Portal for Ship TVs

Status: proposed (Phase 1 in progress on `feat/blits-widget-registry`)
Audience: engineers onboarding cruiselines onto the xTV runtime.

## 1. Problem & forces

Build one LightningJS/Blits Smart-TV runtime, fork it into signed, sideloaded
apps for **8 cruiselines × 3 platforms = 24 artifacts**, and let each line's guest
experience evolve **without a rebuild-and-re-sign of the whole fleet**.

Forces that shape every decision:

- **Scale by config, not by code.** 8 tenants, each with their own Figma designs,
  layouts, brand, endpoints. Hardcoding per-tenant screens does not survive 8 lines.
- **Per-brand isolation (GDPR), non-negotiable.** Each signed artifact compiles in
  **exactly one** tenant. No `import.meta.glob("customers/*")`, ever.
- **Offline-first.** Ship WLAN and head-ends drop. The TV must boot and render from
  bundled fallbacks when the head-end is unreachable.
- **Sideload, no store review.** Distribution via device-management systems
  (Samsung MDC/URL-Launcher, LG Pro:Centric, Android MDM) over the ship network.
- **Low-end TV SoCs.** Canvas/WebGL memory and texture budgets are tight.

## 2. The two axes (unchanged)

```
                 PLATFORM →   samsung(tizen)   lg(webos)   android-tv
CRUISELINE ↓                  ─────────────────────────────────────────
  ccl … +7                    CCL.wgt          CCL.ipk     CCL.apk
```

- **Cruiseline (tenant)** owns endpoints, websocket URLs, remote keymap, theme,
  brand assets, app identity, **layout**, and its own signing certs — `customers/<slug>/`.
- **Platform (container)** owns package format, signing mechanics, native player —
  `platforms/<platform>/`.

## 3. Runtime split — code vs. data

The load-bearing idea: **the binary ships rarely; the experience ships as data.**

| Concern | Where | Changes how |
|---|---|---|
| Widget **types** (hero, itinerary, movie-rail, grid, messaging…) | compiled Blits components, per-tenant **registry** | code → rebuild + re-sign (rare) |
| Widget **arrangement** (which, order, gating, props, data source) | `home.json` bundled + **head-end override** | config push (common, no rebuild) |
| Brand (theme, fonts, assets, identity) | build-time tenant assets | rebuild (brand change) |

```
 BUILD-TIME (per tenant, isolated)          RUNTIME (on the TV, ship WLAN)
 ┌──────────────────────────┐               ┌──────────────────────────────┐
 │ Widget REGISTRY           │  compiled     │ Layout HOST (Blits Router)    │
 │  name → Blits component    │─────────────▶│  routes built from home.json  │
 │  ONE tenant's widgets      │               │  <RouterView> swaps active view│
 └──────────────────────────┘               │  persistent chrome (side-nav)  │
 ┌──────────────────────────┐               └──────────────▲───────────────┘
 │ bundled home.json (fallback)│                            │ layout JSON + props
 └──────────────────────────┘                RUNTIME data ─┤ (data, not code)
 DMS pushes .wgt/.ipk/.apk ────────────────▶ ┌─────────────┴───────────────┐
 (MDC/URL-Launcher, Pro:Centric, MDM)        │ HEAD-END per ship            │
                                             │  layout override + content    │
                                             │  WS: config.updated, mute,    │
                                             │      now-playing, messaging   │
                                             └──────────────────────────────┘
```

## 4. The dynamic layout host (Phase 1) — decisions

### 4.1 Widget registry
A per-build `Record<widgetName, BlitsComponent>` mapping `home.json` `widget`
names to compiled Blits components. It is the `components` set the host knows.
**Never globs tenants** — the build-time `@x-tv/tenant/*` alias keeps one tenant's
widget set in the artifact.

### 4.2 View switching — Blits Router, not dynamic `is`
Investigated and **rejected** `<Component is="$name">`: Blits resolves `is` **once
at mount** and does not reactively swap it (verified — a keyed standalone element
and a `:for`+`:show` over a recomputed array both kept the first view). It proves
name→component resolution but is not a view-switcher.

**Chosen:** Blits' built-in **Router** — `routes`, `$router.to(path)`,
`<RouterView>`, `keepAlive`. Routes are built from `home.json` sections resolved
through the registry. `keepAlive: true` preserves a view's loaded state (a movie
rail keeps its fetched data and scroll position across switches).

```
routes = sections.map(s => ({
  path: s.widget,
  component: registry[s.widget],
  options: { keepAlive: true },
}))
```

### 4.3 Focus state → appState (the deliberate shift)
Router-mounted components can't take reactive **template** props (they're mounted
by the router, not bound in a parent template). So shared focus/navigation state —
`column`, and per-view indices (`contentIndex`, `railIndex`, `colIndex`) — moves to
the **Blits `appState` plugin**. The App's input handlers write it; the routed
widgets read it via `this.$appState`. This is cleaner than prop-drilling **and** it
is precisely the reactive-appState foundation Phase 2 needs to retire the reload.

### 4.4 Spatial focus
The current two-column model (side-nav ⇄ content) generalizes to: persistent nav
chrome owns up/down over routes; the active view owns up/down/left/right over its
own geometry, reading/writing focus via appState. A later generalization walks an
arbitrary node tree for multi-region screens.

### 4.5 Offline-first
Bundled `home.json` + each widget's bundled sample data always render. Head-end
layout/content is an **override**; any fetch failure falls back with a warning and
never blocks first paint.

## 5. Data & realtime

- **Service gateway** binds each widget's `dataSource` (itinerary, movies, …) to a
  backend adapter (xmm / liferay / remote-control). Phase 2: `node.dataSource` lives
  in the layout JSON, not derived in code.
- **Websocket** feeds reactive `appState` topics: `config.updated` (re-pull + apply),
  `audio.mute` (announcement overlay), plus future now-playing / messaging. Widgets
  subscribe to appState, not to the socket directly.
- **Hot-apply** target (Phase 2): apply config/layout by mutating appState in place
  instead of `location.reload()`.

## 6. Deployment & fleet

- **Signing** is pluggable per `(cruiseline, platform)` from env / gitignored local
  file; unsigned + loud warning when absent, build stays green.
- **Versioning** per tenant in `customers/<line>/release.json` (engineering-owned,
  build-time). SSSP `<ver>` bump forces URL-Launcher re-download.
- **Rollout**: canary one ship before the fleet; DMS pushes the artifact, head-end
  pushes layout/content. A screen change is a head-end push, not a fleet re-sign.

## 7. Onboarding a new cruiseline (the 8-tenant workflow)

1. `customers/<slug>/` — `config.json` (endpoints, keymap, identity, features),
   `layouts/home.json` (from the line's **Figma** design → sections/rows/props),
   `fonts.json`, `assets/`, `i18n/`, `release.json`.
2. Map its head-end alias in `tools/packaging/customer-slug.mjs` (build-time only).
3. Reuse existing widgets; author a new Blits widget **only** for a genuinely new
   design element, then register it.
4. `nx build <platform> --customer=<slug>` → signed artifact.

Figma → layout JSON + widget props + theme tokens is the per-tenant unit of work.
Core runtime is untouched.

## 8. Phasing

- **Phase 1 (now)** — widget registry + Router host + appState focus, over the
  widgets we have. 8 tenants differ purely by config.
- **Phase 2** — head-end layout authoring, `node.dataSource` binding, true hot-apply
  (retire the reload).
- **Phase 3** — widget catalogue growth (wayfinding, bookings, live TV, room
  controls), feature-flag A/B, analytics.

## 9. Risks & mitigations

- **TV SoC memory** — cap concurrent poster textures, lazy off-screen rails, cap MSDF
  atlases; verify on real Tizen hardware (emulator dead on Apple Silicon).
- **Isolation regression** — registry + layout loader stay per-tenant-aliased; one
  glob leaks rival brands into a signed artifact. Load-bearing.
- **Flaky ship WLAN** — WS backoff + resubscribe; never block first paint on the socket.
- **Router focus coordination** — keepAlive + appState focus must be reset/preserved
  deliberately per route to avoid stale highlights.
