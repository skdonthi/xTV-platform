# TV Platform Reference — Keycodes & Device APIs

Per-platform remote keycodes and device-API facts, verified against the legacy
`XMedia-Frontend-Legacy` device services (`showcase/ccl/app/services/devices/*`).
This is the source of truth for `libs/navigation` base keymaps and future platform
adapters.

## How the keymap system works

- **Semantic actions, not raw keys.** App code listens for `xtv:action` events
  (`up`, `down`, `enter`, `back`, `red`, `channelUp`, …), never physical keycodes.
- **Base + override.** `libs/navigation` holds a **base keymap per platform** (the
  TV's real codes, below) merged with the **cruiseline override** (`keymap` section
  of `customers/<line>/config.json`). Override is additive per action.
- **Triple match.** Each keypress is matched against `event.key`, `event.code`, and
  `event.keyCode`, so both web names (`"ArrowUp"`) and numeric TV codes (`10009`)
  resolve to the same action.
- **Dynamic.** A single engine lives for the app's lifetime; `setKeymap()` swaps the
  mapping live on a hot config apply — a remap ships via head-end config + a
  `config.updated` push, **no reboot** (see `config-hot-reload.md`).

**Every TV has its own codes.** Arrows (37–40), Enter (13) and color keys (403–406)
are shared; the rest diverge sharply — note `back`: Tizen `10009`, webOS `461`,
Exterity `3`.

## Keycode tables

### Samsung Tizen (`samsungTizenService.js`, `…FromVersionSixFive…`)
| Action | Code(s) | | Action | Code(s) |
|---|---|---|---|---|
| up / down / left / right | 38 / 40 / 37 / 39 | | red / green / yellow / blue | 403 / 404 / 405 / 406 |
| enter | 13 | | channelUp / channelDown | 427 / 428 |
| back (Return) | 10009 | | volumeUp / volumeDown / mute | 447 / 448 / 449 |
| exit | 10182 | | play / pause / stop | 415 / 19 / 413 |
| info | 457 | | forward / rewind / playPause | 417 / 412 / 10252 |
| numbers 0–9 | 48–57 | | menu / smartHub / source | 10133 / 10071 / 10072 |

**Samsung version strategy (Tizen 6.5 / 7 / 9 / 10):** profiles are capability
tiers (`tizen6`=6.5, `tizen7`, `tizen9`, `tizen10`), each with an explicit
`apiVersion`. That `apiVersion` becomes the widget's `required_version` — the
**minimum** Tizen the `.wgt` installs on — and the artifact name (`CCL_T65…` →
`CCL_T90…`). Keycodes are identical across these versions. For the **widest** fleet
install, build the **lowest** profile you support (e.g. `tizen6` → runs 6.5→10);
build a higher profile only when you deliberately require newer firmware (e.g. an
AV1/HDR-only build). Higher `maxTextureSize` / `av1` / `hdr` caps let widgets
feature-gate at runtime.

### LG webOS (`lgService.js`, HCAP)
| Action | Code(s) | | Action | Code(s) |
|---|---|---|---|---|
| up / down / left / right | 38 / 40 / 37 / 39 | | red / green / yellow / blue | 403 / 404 / 405 / 406 |
| enter | 13 | | channelUp / channelDown | 427 / 428 |
| back (Return) | 461 | | play / pause / stop | 415 / 19 / 413 |
| exit | 1001 | | forward / rewind | 417 / 412 |
| info / guide | 457 / 458 | | PIP / swap | 715 / 719 |

### Exterity STB (`exterityService.js`, Ekioh — maritime/hospitality)
| Action | Code(s) | | Action | Code(s) |
|---|---|---|---|---|
| up / down / left / right | 38 / 40 / 37 / 39 | | red / green / yellow / blue | 917555 / 917776 / 917556 / 918022 |
| enter | 13 | | volumeUp / volumeDown / mute | 917747 / 917748 / 917744 |
| back (Return) | 3 | | play / stop | 917520 / 917522 |
| exit | 0 | | forward / rewind | 917524 / 917523 |

> Exterity uses proprietary `917xxx` Ekioh codes. Not a current build target, but
> kept here because CCL sails with Exterity STBs in some cabins.

### Android TV
No legacy reference (Android wasn't in the legacy stack). Android TV WebView emits
standard DOM key events for the D-pad; the hardware BACK button is delivered by the
native bridge as `"GoBack"` (see `platforms/android/.../MainActivity.kt`).

## Device APIs (per platform)

| Platform | Detect (user-agent) | Video API | MAC | Power state |
|---|---|---|---|---|
| Samsung Tizen 6.5+ | `tizen` | `webapis.avplay` | `webapis.network.getMac()` | `webapis.remotepower.getPowerState()` |
| Samsung Tizen <6.5 | `tizen` | `webapis.avplay` | `b2bapis.b2bcontrol.getMACAddress()` | `b2bapis.b2bpower.getPowerState()` |
| Samsung legacy (Maple) | `maple` | Samsung player plugin | `networkPlugin.GetMAC()` | `tvPlugin GetPowerState` |
| LG webOS | `lge` | `hcap.Media` | `hcap.network.getNetworkDevice().mac` | `hcap.power.getPowerMode()` (0=off,1=normal,2=standby) |

**LG version strategy (webOS 3.6 / 5 / 6):** two LG runtimes exist — **HCAP**
(hospitality / Pro:Centric, firmware-injected `hcap`, not bundled) and
**webOSTV.js** (consumer/Content-Store, luna wrapper, bundled, version-tolerant).
We are HCAP-first. The LG audio adapter is capability-aware: use `hcap.setMute`
when present, else fall back to luna (`webOS.service.request`, from webOSTV.js) for
older firmware that lacks it, else a local flag. webOSTV.js is LG-proprietary —
vendor it to `apps/lg-tv/webOSTV.js` and enable the tag in that app's `index.html`
only if the luna fallback is actually needed. Profiles: `webos3`, `webos5`, `webos6`.
| Exterity | `ekioh` | HTML5 `<video>` + `extplugin` | `extplugin.netinterfaces[0].hwaddr` | hardcoded normal |
| Browser (dev) | fallback | HTML5 `<video>` | mock (`?macid=`) | hardcoded normal |

These map onto our abstractions: the audio adapter (`libs/muting`) uses
`tizen.tvaudiocontrol` / luna / native bridge; the **player adapter**
(`libs/player`) wraps `avplay` (Samsung), the Android ExoPlayer bridge, and HTML5
`<video>` (webOS/browser) behind one `PlayerAdapter` port + `createPlayerAdapter`
factory. Wire it into a video/live-TV widget when one is added. Diagnostics
device-info reads MAC via the APIs above.
