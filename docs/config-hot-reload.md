# Config Hot Reload — Change Config Without Rebooting the TV

A cabin TV must pick up config changes (a new home layout, a toggled feature, a
swapped endpoint, a theme) **without** a firmware reboot, a reinstall, or even a
visible black flash. This doc explains how xTV does that.

## The layered config model

Config comes from two places, merged at boot:

```
customers/<line>/config.json         head-end: <configUrl>/…
      (bundled FALLBACK,               (AUTHORITATIVE override,
       sealed in the .wgt/.ipk)         per-ship / per-cabin)
            │                                   │
            └──────────────┐     ┌──────────────┘
                           ▼     ▼
                     deepMerge(bundled, remote)
                           │
                           ▼
                     live RuntimeConfig
```

- The **bundled** `config.json` is baked into the signed artifact. You never edit
  it in place — the package is sealed and signed. It is the offline **fallback**.
- The **head-end** config (`integrations.configUrl`) is authoritative. It is fetched
  at boot and **deep-merged on top** of the bundled defaults. Change the head-end
  JSON → every TV picks it up on its next config load — **no rebuild, no reinstall**.
- If the fetch fails (offline, head-end down), the app runs on bundled defaults.

Code: `applyRemoteOverride()` + `deepMerge()` in
[`libs/runtime-config/src/index.ts`](../libs/runtime-config/src/index.ts).

## Three levels of applying a change (cheapest first)

| Level | Trigger | What it applies | TV reboot? |
|---|---|---|---|
| **Hot re-apply** | `config.updated` push | layout, theme, features, endpoints, **keymap** | No — seamless, no flash |
| **Soft reload** | fallback on error | everything config-driven | No — app re-boots (~1s), TV stays on |
| **Rebuild + reinstall** | new widget **code** | new binary | No, but reinstall via SSSP/ares/adb |

**Everything config-driven is hot-applyable** because the renderer rebuilds `#app`
from the config snapshot on every call — re-running it with fresh config *is* the
live update. Only shipping **new widget code** needs a rebuild.

### Keymap is hot too

A single navigation engine lives for the app's lifetime; `applyAndRender` calls
`navigation.setKeymap(config.keymapOverride)`, which swaps the internal lookup with
no re-subscribe and no leaked listener. So a cruiseline can remap its remote
(`keymap` section of `config.json`, delivered via the head-end override) and push
`config.updated` — the new mapping takes effect on the very next keypress, no reboot.

Code: `setKeymap()` in [`libs/navigation/src/index.ts`](../libs/navigation/src/index.ts),
called from `applyAndRender()` in [`libs/core/src/index.ts`](../libs/core/src/index.ts).

## The live-reload trigger (websocket)

The head-end pushes a message on the tenant's websocket
(`integrations.websocket.url`):

```json
{ "type": "config.updated" }
```

The app, on receipt:
1. re-runs the config loader → **re-fetches** the head-end override,
2. calls `applyAndRender(config)` → rebuilds `#app` + re-attaches navigation,
3. on any error, falls back to `location.reload()`.

```
head-end ──ws {type:"config.updated"}──▶ loader.load() (re-fetch + merge)
                                              │
                                              ▼
                                      applyAndRender(config)
                                       ├─ new service gateway (new endpoints)
                                       ├─ fetch active layout
                                       ├─ render #app  (renderer clears + rebuilds)
                                       └─ navigation.attach (idempotent, no dup listeners)
                                              │
                                    error? ──▶ location.reload()  (soft fallback)
```

Code: `connectLiveConfig()` + `applyAndRender()` in
[`libs/core/src/index.ts`](../libs/core/src/index.ts). The `xtv:action` navigation
listener is idempotent (AbortController), so re-rendering never stacks duplicate
key handlers.

## Why this is safe

- **Offline-resilient** — a failed override fetch never bricks the app; it uses
  bundled defaults.
- **No stacked state** — the renderer clears `#app`; navigation cancels its prior
  listener before re-attaching.
- **Fail-safe** — if a hot apply throws (malformed config, render error), the app
  soft-reloads instead of sitting half-rendered.
- **Same control channel** as other head-end events (e.g. `audio.mute`) — one
  socket per tenant, multiple event types.

## Operating it (head-end side)

1. Update the tenant config served at `configUrl` (e.g. `…/config/ccl.json`).
2. Push `{ "type": "config.updated" }` on the tenant websocket to make TVs apply it
   immediately; otherwise they pick it up on their next boot/config load.
3. For a layout-only change you can instead flip `integrations.runtime.layoutSource`
   to a remote source (`xmm` / `liferay`) — the layout is then fetched at runtime and
   a `config.updated` push re-pulls it, no bundled-layout change needed.

## What still needs a rebuild

- A **new widget type** (new code in `libs/widget-registry` / `libs/widgets`).
- A change to **native/platform behavior** (manifest, privileges, signing).
- A **keymap** change (until live keymap swap is supported — uses soft reload today).

Everything else — arrangement, content, flags, theme, endpoints — is config.
