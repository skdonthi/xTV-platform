# State & Storage

How the app holds state in memory and persists data. Four layers, each with a
clear job — don't reach for a heavier one than the data needs.

## The layers

| Layer                        | Use for                                                                  | Where                                      | Persists?                           |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------- |
| **Component state**          | Local UI state for one screen/widget                                     | Blits `state()`                            | No (in-memory, per-component)       |
| **Global reactive state**    | Cross-screen app state that UI reacts to                                 | Blits `appState` plugin → `this.$appState` | No (in-memory, app lifetime)        |
| **Boot config snapshot**     | The full resolved `RuntimeConfig` (layout, services, features, platform) | `@x-tv/core` `getBootConfig()`             | No (set once at launch)             |
| **Device-local persistence** | Small device-scoped values (deviceId, last focus, volume)                | `@x-tv/storage` `createStorage(ns)`        | Yes — localStorage, **best-effort** |
| **Durable / authoritative**  | Guest prefs, entitlements, resume points, messages                       | **Head-end** via `@x-tv/service-gateway`   | Yes — server of record              |

## Global reactive state — Blits `appState`

Registered once in `libs/core` before launch, seeded from config:

```ts
Blits.Plugin(appStatePlugin, {
  customer: runtimeConfig.customer,
  platform: runtimeConfig.platform.platform,
  locale: runtimeConfig.locale,
});
```

Read/write in any component via `this.$appState`:

```ts
computed: {
  caption() {
    const app = this.$appState; // { customer, platform, locale, ... }
    return `${app.customer} · ${app.platform}`;
  },
}
```

Use it for state the UI must react to across screens. It is **not** persisted —
it resets on reload/relaunch (which is fine; the boot config re-seeds it).

## Persistence — `@x-tv/storage`

A reusable, namespaced wrapper over Blits' `storage` plugin (localStorage), with
an **in-memory fallback** so calls never throw on a TV with no/limited storage.
Safe to import **anywhere** — at bootstrap, in libs, or inside components.

```ts
import { createStorage } from "@x-tv/storage";

const store = createStorage("device"); // keys are prefixed  xtv.device.
store.set("id", "abc-123");
const id = store.get<string>("id"); // "abc-123" | null
store.remove("id");
```

- **Namespaced** `xtv.<namespace>.<key>` so features never collide.
- **Fallback**: if `localStorage` is unavailable (file://, private mode, quota),
  it transparently uses an in-memory Map for the session.
- Backed by the Blits `storage` plugin — one dependency, one convention.

## TV reality — treat localStorage as best-effort

localStorage works on Tizen/webOS WebViews (and under `file://` in a bundled
widget, scoped to that origin), **but**:

- quota is small,
- it can be **wiped on app update, uninstall, or memory pressure**.

So `@x-tv/storage` is only for **device-local, non-critical** values. Anything
that must survive — guest preferences, entitlements, watch history, room
messaging — is **authoritative on the head-end**, fetched/written through
`@x-tv/service-gateway`, keyed by device/cabin. The TV is a cache, not the record.

## Decision guide

- Screen-only toggle/scroll position → **component `state()`**.
- Something other screens read and react to → **`this.$appState`**.
- Need the full config (layout, services, features) in code → **`getBootConfig()`**.
- Remember a small value on this device between sessions → **`createStorage()`**.
- Must never be lost / shared across devices → **head-end via service-gateway**.

## Notes

- Blits' own reactivity + `appState` cover global state.
- `appState` seeds the reactive subset; `getBootConfig()` remains the full
  static snapshot (layout, services, keymap, fonts) for code that needs it.
