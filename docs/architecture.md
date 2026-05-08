# Architecture

## Architectural Principle

Apps stay thin. They bootstrap a platform runtime and provide packaging entrypoints only. Reusable behavior lives in `libs/`, customer customization lives in `customers/`, and OS/device differences live in `platforms/`.

## Runtime Flow

```txt
apps/samsung-tv/src/main.ts
  -> @x-tv/core
    -> @x-tv/runtime-config
      -> customers/demo-hotel/config/runtime.json
      -> customers/demo-hotel/config/integrations.json
      -> customers/demo-hotel/layouts/home.json
      -> platforms/samsung/profiles/tizen6.json
    -> @x-tv/service-gateway
      -> @x-tv/integrations/xmm-api
      -> @x-tv/integrations/liferay-api
      -> @x-tv/integrations/remote-control-api
    -> @x-tv/widget-registry
    -> @x-tv/layout
    -> @x-tv/navigation
```

## Dynamic Layouts

Layouts are JSON documents with a stable schema:

```json
{
  "id": "demo-hotel-home",
  "version": 1,
  "root": {
    "id": "home-screen",
    "type": "screen",
    "children": [
      {
        "id": "hero",
        "type": "widget",
        "widget": "hero-banner",
        "props": {}
      }
    ]
  }
}
```

The layout renderer must remain generic. It should understand layout primitives and delegate widget creation to the widget registry. Customer-specific decisions belong in layout JSON, runtime config or domain services.

## Widgets

Widgets are reusable LightningJS components exposed through `WidgetDefinition` contracts. The registry maps server-driven widget keys to concrete implementations. Widget keys are part of the remote layout API and should be stable.

Recommended names:

- `hero-banner`
- `content-rail`
- `live-tv-guide`
- `guest-message-center`
- `room-service-menu`

## Platform Profiles

Profiles describe OS capabilities such as player adapter, DRM support, texture limits and realtime availability. Capability detection augments the selected profile at runtime so one app package can adapt to the actual device.

Example:

```sh
nx build samsung --customer=AIDA --profile=tizen6
```

This builds the Samsung shell, loads the AIDA customer alias, and selects the Tizen 6 platform profile.

## Diagnostics

`libs/diagnostics` owns TV-friendly runtime diagnostics:

- Best-effort device information collection.
- Top-right demo banner with platform, profile, customer, MAC, model and build.
- On-screen console overlay that mirrors browser console calls.
- Remote-friendly PIN unlock for the console overlay.

Browsers intentionally do not expose MAC addresses. Real device values must come from platform APIs:

- Samsung Tizen: `webapis.productinfo` and `webapis.network`.
- LG webOS: `PalmSystem` or a native/service bridge.
- Android TV: a native bridge such as `globalThis.xtvAndroid`.

Use the on-screen console for field debugging where a terminal is not available. Toggle it by entering the customer diagnostics PIN on the TV remote numeric keypad. Developer shortcuts such as `F2`, `D`, `Info`, and `ColorF0Red` can remain enabled for lab builds.

The diagnostics PIN is customer configuration, not app logic:

```json
{
  "diagnostics": {
    "enabled": true,
    "pin": "2580",
    "pinTimeoutMs": 5000,
    "developerShortcuts": true
  }
}
```

## Remote Layout Delivery

The local JSON loader is intentionally behind `createRuntimeConfigLoader`. Replace that implementation with a service-backed loader when the backend is ready:

```txt
device boot
  -> fetch tenant config
  -> fetch active layout version
  -> validate layout schema
  -> hydrate feature flags and theme
  -> render registered widgets
```

The app does not need redeployment for layout changes when those changes use already bundled widgets.

## Backend Integrations

Backend-specific adapters live in `libs/integrations/*`:

- `libs/integrations/xmm-api`
- `libs/integrations/liferay-api`
- `libs/integrations/remote-control-api`

Adapters own transport, authentication headers, URL construction, DTOs and backend-specific errors. They should not contain product workflows or UI assumptions.

`libs/service-gateway` is the platform-facing boundary. It composes adapters and exposes stable APIs:

- `content.getHomeContent()`
- `layout.getActiveLayout(fallbackLayout)`
- `remoteControl.createPairingSession()`

Customer integration selection belongs in `customers/<customer>/config/integrations.json`:

```json
{
  "runtime": {
    "customerId": "demo-hotel",
    "layoutSource": "local",
    "contentSource": "local"
  }
}
```

Switch `layoutSource` or `contentSource` to `xmm` or `liferay` when those backend endpoints are ready. The app shell and widgets should not change.

## Dependency Recommendations

- `apps/*` imports `@x-tv/core`.
- `libs/core` composes runtime services.
- `libs/runtime-config` loads customer, platform and environment config.
- `libs/layout` owns layout contracts and rendering.
- `libs/widgets` owns LightningJS components.
- `libs/widget-registry` owns widget lookup and registration.
- `libs/navigation` owns TV remote and focus behavior.
- `libs/player` owns playback abstraction contracts.
- `libs/websocket` owns realtime transport.
- `libs/integrations/*` owns backend-specific API clients and DTOs.
- `libs/service-gateway` owns backend selection and platform-facing data contracts.

No library may import from `apps/`. Customer data should not import code.

## Future Work

- Replace the DOM demo renderer with real LightningJS stage/component mounting.
- Add schema validation for remote layouts.
- Add Nx module-boundary rules once all domain tags are defined.
- Add native packaging executors for `.wgt`, `.ipk` and `.apk`.
- Add platform-specific player adapters behind `@x-tv/player`.
- Add Zustand stores for runtime session state and user preferences.
