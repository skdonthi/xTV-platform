// Theme TYPE + resolver only. The token sets are a per-tenant BUILD-TIME brand
// asset (like fonts — decision 13), loaded via the `@x-tv/tenant/themes` alias
// from `customers/<slug>/themes.json`. So a brand's palette never ships in another
// brand's build (per-brand isolation, decision 4). The active theme id is selected
// by `config.theme` (head-end-overridable); the token VALUES are baked at build.
//
// Add/edit colors → the tenant's `themes.json`. Add a cruiseline → its `themes.json`
// (from Figma tokens). Pick the active theme → `config.json` `runtime.theme`.
import tenantThemes from "@x-tv/tenant/themes";

export interface ThemeColors {
  background: string; // screen base
  surface: string; // rows / cards
  text: string; // primary text
  textMuted: string; // captions / secondary
  accent: string; // brand action / highlight
  accentText: string; // text drawn on `accent`
  focus: string; // D-pad focus ring (high-contrast on TV)
}

export interface ThemeTokens {
  id: string;
  colors: ThemeColors;
}

// themes.json is a map of theme id → colors.
const palettes = tenantThemes as unknown as Record<string, ThemeColors>;

export const themeIds = Object.keys(palettes);

// Last-resort neutral palette so getTheme never returns undefined even if a tenant
// ships no themes (build stays green; nothing renders invisible).
const FALLBACK: ThemeColors = {
  background: "#05101E",
  surface: "#0E2038",
  text: "#F5F8FB",
  textMuted: "#8FA6BD",
  accent: "#E4002B",
  accentText: "#FFFFFF",
  focus: "#4FA3E3",
};

// Resolve a theme by id; falls back to the tenant's first theme, then a neutral.
export function getTheme(id: string): ThemeTokens {
  const firstId = themeIds[0];
  const colors = palettes[id] ?? (firstId ? palettes[firstId] : undefined) ?? FALLBACK;
  return { id, colors };
}
