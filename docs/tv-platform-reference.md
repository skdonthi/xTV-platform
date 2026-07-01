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
| Exterity | `ekioh` | HTML5 `<video>` + `extplugin` | `extplugin.netinterfaces[0].hwaddr` | hardcoded normal |
| Browser (dev) | fallback | HTML5 `<video>` | mock (`?macid=`) | hardcoded normal |

These map onto our abstractions: the audio adapter (`libs/muting`) uses
`tizen.tvaudiocontrol` / luna / native bridge; the **player adapter**
(`libs/player`) wraps `avplay` (Samsung), the Android ExoPlayer bridge, and HTML5
`<video>` (webOS/browser) behind one `PlayerAdapter` port + `createPlayerAdapter`
factory. Wire it into a video/live-TV widget when one is added. Diagnostics
device-info reads MAC via the APIs above.
