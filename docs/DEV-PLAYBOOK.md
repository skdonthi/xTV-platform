# xTV Development Playbook

How we build features on xTV — the tools/skills to reach for and a paste-ready
kickoff prompt. Use this at the start of any non-trivial feature or UI task.

## Kickoff prompt (paste into Claude Code)

```
Act as a software systems architect AND a hospitality-TV technical expert.
We are building the CCL production TV app on the xTV platform (LightningJS,
Samsung Tizen / LG webOS / Android TV; hospitality sideload). Read CLAUDE.md
first for architecture + decisions.

For this task:
0. Run /security-review on any change touching config, signing, network, or
   input before we commit.
1. Use /Design with a Hospitality-TV lens (10-foot UI, D-pad-only navigation,
   overscan-safe margins, large hit targets, no hover/pointer assumptions).
2. Use /frontend-design tuned for Hospitality TVs (readable at distance, high
   contrast, focus-visible states, 1080p canvas).
3. Reference the official Blits example app for real LightningJS patterns:
   https://github.com/lightning-js/blits-example-app — mirror their component,
   routing, and focus idioms rather than inventing our own.
4. Use /ui-ux-pro-max for layout, palette, typography and component polish.
5. Run /ponytail-review then /ponytail-audit on the diff before finishing.
6. Use Superpowers for multi-step orchestration when the task is large.
7. Use Chrome DevTools (via the preview/browser tools) to inspect rendered
   output, focus order, console, and network while iterating.
8. Finish by acting as the architect again: propose concrete improvements to
   structure, isolation, performance, and TV-platform correctness.
```

## When to reach for each

| Tool / skill | Use it when |
|---|---|
| `/security-review` | Any change to config loading, signing, websockets, remote fetch, or input handling. Always before commit on those. |
| `/Design` (Hospitality-TV lens) | Designing a new screen or flow. Enforce 10-foot UI, D-pad focus, overscan-safe margins. |
| `/frontend-design` (Hospitality-TV) | Turning a design into TV-correct UI — contrast, focus-visible, distance legibility. |
| Blits example app | Any LightningJS component/routing/focus question. Copy their idioms: <https://github.com/lightning-js/blits-example-app> |
| `/ui-ux-pro-max` | Palette, typography, spacing, component states, polish. |
| `/ponytail-review`, `/ponytail-audit` | Reviewing/auditing the diff before finishing. |
| Superpowers | Large multi-step tasks that benefit from orchestration. |
| Chrome DevTools / preview tools | Inspecting rendered output, focus order, console errors, network on the running app. |
| Architect + hospitality-TV expert persona | Kickoff (scope/approach) and wrap-up (improvement proposals). |

## Hospitality-TV rules of thumb (non-negotiable)

- **D-pad only.** No hover, no pointer. Every interactive element is reachable
  and visible via `xtv:action` focus. Test focus order.
- **Overscan.** Keep content inside a safe margin (~5% each edge); TVs crop.
- **10-foot UI.** Large text, high contrast, few elements per screen.
- **CSP.** Tizen strips inline `<script>`/`<style>` — the config.xml CSP fix is
  mandatory (see CLAUDE.md / docs/signing.md).
- **Config-driven.** New behavior ships via config/flags/remote layout where
  possible, not a new binary. Rebuild only for genuinely new widget code.
- **Per-brand isolation.** Never bundle other cruiselines' data (see CLAUDE.md).
