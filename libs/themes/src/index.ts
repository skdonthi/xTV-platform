// Carnival brand themes — "moments aboard". The funnel's red/white/blue is the
// constant identity; each theme shifts the environment (light + place). The
// active theme is selected by the tenant config (`runtime.theme`); resolve one
// with getTheme(id). (Device/group-driven theme selection comes later via XMM.)
//
// Brand anchors: Carnival Navy #003C71 · Carnival Red #E4002B · Sun Gold #FFB81C.

export interface ThemeTokens {
  id: string;
  colors: {
    background: string; // screen base
    surface: string; // rows / cards
    text: string; // primary text
    textMuted: string; // captions / secondary
    accent: string; // brand action / highlight
    accentText: string; // text drawn on `accent`
    focus: string; // D-pad focus ring (high-contrast on TV)
  };
}

// Bright atrium — daytime public spaces (lobby).
export const carnivalDay: ThemeTokens = {
  id: "carnival-day",
  colors: {
    background: "#F2F6FB",
    surface: "#FFFFFF",
    text: "#003C71",
    textMuted: "#5B7A99",
    accent: "#E4002B",
    accentText: "#FFFFFF",
    focus: "#0072CE",
  },
};

// Ocean immersive — balcony, horizon in view.
export const carnivalSea: ThemeTokens = {
  id: "carnival-sea",
  colors: {
    background: "#003C71",
    surface: "#0A4E86",
    text: "#FFFFFF",
    textMuted: "#A9C5DD",
    accent: "#FFB81C",
    accentText: "#003C71",
    focus: "#FFB81C",
  },
};

// Golden hour — warm dusk variant.
export const carnivalSunset: ThemeTokens = {
  id: "carnival-sunset",
  colors: {
    background: "#2A1330",
    surface: "#4A2438",
    text: "#FFF3E6",
    textMuted: "#E4A79C",
    accent: "#FF6B4A",
    accentText: "#2A1330",
    focus: "#FFB81C",
  },
};

// Cabin after dark — low-glare, high-contrast for in-cabin evening comfort.
export const carnivalNight: ThemeTokens = {
  id: "carnival-night",
  colors: {
    background: "#05101E",
    surface: "#0E2038",
    text: "#F5F8FB",
    textMuted: "#8FA6BD",
    accent: "#E4002B",
    accentText: "#FFFFFF",
    focus: "#4FA3E3",
  },
};

const registry: Record<string, ThemeTokens> = {
  [carnivalDay.id]: carnivalDay,
  [carnivalSea.id]: carnivalSea,
  [carnivalSunset.id]: carnivalSunset,
  [carnivalNight.id]: carnivalNight,
};

export const themeIds = Object.keys(registry);

// Resolve a theme by id; falls back to the bright day theme if unknown.
export function getTheme(id: string): ThemeTokens {
  return registry[id] ?? carnivalDay;
}
