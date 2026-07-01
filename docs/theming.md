# Theming

Themes are **config-driven**: the tenant config picks one theme by id. Multiple
themes ship in the app; the config selects which one is active. (Device/group-
driven theming — different theme per balcony/lobby/cabin — comes later via XMM;
it's not wired in the client.)

## Concept — "moments aboard"

Carnival's funnel (red / white / blue) is the constant brand identity; each theme
shifts the *environment* (light + place). Brand anchors: Carnival Navy `#003C71`,
Carnival Red `#E4002B`, Sun Gold `#FFB81C`.

| Theme id | Mood |
|---|---|
| `carnival-day` | bright atrium — sky-white bg, navy text, red accent |
| `carnival-sea` | ocean immersive — deep navy bg, white text, gold accent |
| `carnival-sunset` | golden hour — plum bg, cream text, coral accent |
| `carnival-night` | dark, low-glare — near-black navy, red glow accent |

## Tokens

Each theme is a `ThemeTokens` (`libs/themes`): `background`, `surface`, `text`,
`textMuted`, `accent`, `accentText`, `focus`. `focus` is the D-pad focus color —
always high-contrast on its background (TVs are navigated from a couch). Resolve
one with `getTheme(id)`.

## Config

In `customers/<line>/config.json` → `runtime`:

```jsonc
"theme": "carnival-day"
```

`runtime-config` sets `runtimeConfig.theme` from this; the root app resolves it via
`getTheme(id)`, passes the tokens into components, and seeds it into
`this.$appState.theme`. Changing the theme is a config change (and takes effect on
a head-end config push, no rebuild).

## Adding a theme

Add a `ThemeTokens` in `libs/themes`, register it, set its id as a tenant's
`theme`. New brand = its own theme set; nothing else changes.
