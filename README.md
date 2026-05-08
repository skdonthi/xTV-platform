# xTV-platform

`xTV-platform` is a configurable Smart TV runtime platform for hospitality, IPTV and OTT use cases. It is an Nx monorepo built around TypeScript, LightningJS, Vite, Zustand, i18next and platform-specific packaging for Samsung Tizen, LG webOS and Android TV.

This is not structured like a traditional web app. Apps are packaging and bootstrap shells. Product behavior, widgets, layouts, platform abstractions and business rules live in reusable libraries and customer configuration.

## Workspace

```txt
apps/
  samsung-tv/          Thin Samsung/Tizen bootstrap and packaging entrypoint
  lg-tv/               Thin LG/webOS bootstrap and packaging entrypoint
  android-tv/          Thin Android TV bootstrap and packaging entrypoint
libs/
  core/                Platform composition and lifecycle
  layout/              Server-driven layout schema and renderer
  widget-registry/     Widget registration and lookup
  navigation/          TV remote/focus navigation engine
  websocket/           Realtime event bus
  player/              Playback adapter contracts
  i18n/                i18next initialization
  integrations/        Backend API adapters such as XMM, Liferay and remote control
  service-gateway/     Platform-facing service facade over backend sources
  widgets/             LightningJS UI components and widget definitions
  runtime-config/      Customer, profile, feature and layout loading
  feature-flags/       Runtime flag helpers
  themes/              Theme token contracts
customers/
  demo-hotel/          Example white-label customer config, layouts and locale files
platforms/
  samsung/             Samsung platform profiles and future packaging assets
  lg/                  LG platform profiles and future packaging assets
  android/             Android platform profiles and future packaging assets
docs/                  Architecture notes
tools/                 Workspace executors and release/build tooling
```

## Where Code Belongs

Actual source code should be written in `libs/`. Apps must stay thin and only call `bootstrapTvPlatform`.

Widgets live in `libs/widgets`. Widget registration lives in `libs/widget-registry`. Layout schemas and rendering live in `libs/layout`. Customer-owned layout JSON lives in `customers/<customer>/layouts`.

Customer configs live in `customers/<customer>/config`, with locale resources in `customers/<customer>/i18n` and theme selection in runtime config. Platform-specific profiles live in `platforms/<platform>/profiles`. Future native packaging assets such as Tizen manifests, webOS appinfo, Android manifests and signing config should also live under `platforms/`.

LightningJS components belong in `libs/widgets` or lower-level UI libraries added under `libs/`. The demo includes a DOM preview adapter in `libs/widgets/src/components/hero-banner.ts` and a LightningJS component example in `libs/widgets/src/components/hero-banner.lightning.ts`. Business logic belongs in domain libraries under `libs/`, never in `apps/`.

Backend API adapters live in `libs/integrations/*`. They contain low-level transport, auth headers, DTOs and backend-specific response handling. Shared product behavior should consume `@x-tv/service-gateway`, not the adapters directly.

## Composition

One TV app is composed as:

1. The app entrypoint identifies the target OS family and default profile.
2. `@x-tv/core` creates the runtime.
3. `@x-tv/runtime-config` resolves customer config, platform profile, feature flags, layout and runtime capabilities.
4. `@x-tv/service-gateway` selects configured backend sources for layout, content and remote-control services.
5. `@x-tv/widget-registry` exposes available widgets.
6. `@x-tv/layout` renders the customer layout using registered widgets.
7. `@x-tv/navigation` attaches remote-control navigation/focus behavior.

Samsung bootstraps from `apps/samsung-tv/src/main.ts`:

```ts
import { bootstrapTvPlatform } from "@x-tv/core";

void bootstrapTvPlatform({
  appId: "samsung-tv",
  platformId: "samsung",
  defaultProfile: "tizen6"
});
```

## Commands

```sh
npm install
npm run dev:samsung
npm run build:samsung
nx build samsung --customer=AIDA --profile=tizen6
nx build lg --customer=demo-hotel --profile=webos6
nx build android --customer=demo-hotel --profile=android-tv-12
```

`--customer` selects a white-label configuration. `--profile` selects an OS/device capability profile.

For local browser preview, Samsung runs at [http://localhost:4301](http://localhost:4301). To expose the dev server on your LAN for a physical TV, run:

```sh
XTV_DEV_HOST=0.0.0.0 npm run dev:samsung -- --customer=AIDA --profile=tizen6
```

## TV Diagnostics

The runtime mounts a diagnostics banner in the top-right corner. It shows platform, profile, customer, app id, MAC address when the TV runtime exposes it, model and build. Browsers do not expose real MAC addresses for privacy, so local preview shows `unavailable`; Samsung Tizen can use `webapis.network.getMac()`, LG can use `PalmSystem` metadata, and Android TV can provide values through a future native bridge at `globalThis.xtvAndroid`.

There is no practical terminal on most production TV runtimes. For TV debugging, use the built-in diagnostics console:

- Enter the diagnostics PIN on the remote numeric keypad. The demo customer PIN is `2580`.
- Digits must be entered within the configured timeout, currently 5 seconds for the demo customer.
- Browser/developer shortcuts still work when enabled: `F2`, `D`, `Info`, or Samsung red key `ColorF0Red`.
- `console.log`, `console.info`, `console.warn`, and `console.error` are mirrored into the overlay.
- Keep native tools available too: Samsung Remote Web Inspector, LG Web Inspector/ares tooling, Android `adb logcat`, and backend log correlation via `deviceId`.

## Import Patterns

Use package-style aliases for shared platform code:

```ts
import { bootstrapTvPlatform } from "@x-tv/core";
import { createLayoutRenderer } from "@x-tv/layout";
import { createDefaultWidgetRegistry } from "@x-tv/widget-registry";
```

Avoid deep imports across library internals. Export public contracts from each library `src/index.ts`.

Backend integrations use explicit package aliases:

```ts
import { createXmmApiClient } from "@x-tv/integrations/xmm-api";
import { createLiferayApiClient } from "@x-tv/integrations/liferay-api";
import { createRemoteControlApiClient } from "@x-tv/integrations/remote-control-api";
import { createServiceGateway } from "@x-tv/service-gateway";
```

## Dependency Boundaries

Apps may depend on `@x-tv/core` only.

`core` composes libraries but should not contain business logic. `layout` may depend on widget registry contracts. `widget-registry` may depend on widget definitions. Domain libraries should not import app code or platform packaging files.

Customer JSON can be loaded by runtime-config locally today and remotely later. Platform profiles are data, not app logic.

Adapters under `libs/integrations/*` may import only generic platform contracts and their own types. Widgets and apps must not import integration adapters. The service gateway turns backend-specific DTOs into stable platform data contracts.

## Customer Customization Without Redeploy

The demo currently imports `customers/demo-hotel/layouts/home.json` locally. The same `RuntimeConfigLoader` boundary is designed to swap in remote layout delivery later:

```txt
CMS / layout service -> runtime-config -> layout renderer -> widget registry -> Lightning widgets
```

Future customers can customize layouts, themes, feature flags and locale resources through backend-delivered JSON as long as the app already contains the required widget types. New widget implementations require a new app build; new widget arrangements and content do not.

## Scalability Notes

- Add customer folders using kebab-case, for example `customers/aida-cruises`.
- Add widgets with stable type keys, for example `hero-banner`, `live-tv-rail`, `room-service-menu`.
- Keep runtime profiles explicit, for example `tizen6`, `tizen7`, `webos6`, `android-tv-12`.
- Introduce domain libraries under `libs/` as the platform grows, such as `content`, `analytics`, `commerce`, `guest-services` or `epg`.
- Add backend adapters under `libs/integrations/<source>-api`, then expose them through `libs/service-gateway`.
- Enforce module boundaries with Nx tags once domain libraries mature.

See [docs/architecture.md](/Users/shivakrishnadonthi/xcontrol-DEV/myApps/xTV-platform/docs/architecture.md) for the deeper foundation notes.
