import Blits from "@lightningjs/blits";
import { isFeatureEnabled } from "@x-tv/feature-flags";
import { type DrmType, type PlayerAdapter, createPlayerAdapter } from "@x-tv/player";
import { getTheme } from "@x-tv/themes";
import { CONTENT_WIDGETS, SideNav } from "@x-tv/widgets";
import { getBootConfig } from "./boot-config";

// Register content widgets from the registry under capitalized tag names (Blits
// only resolves capitalized tags as components, and precompiles templates at
// build so the tags must be static — see the template below). The registry is
// still the single source of name→component + home.json validation.
const contentComponents: Record<string, unknown> = {};
for (const [name, component] of Object.entries(CONTENT_WIDGETS)) {
  contentComponents[name.charAt(0).toUpperCase() + name.slice(1)] = component;
}

interface PlayEntry {
  rail: number;
  col: number;
  url: string;
  title: string;
  drm: string;
}

interface Section {
  label: string;
  widget: string;
}
interface NavItem {
  label: string;
  y: number;
}

type AppThis = {
  navIndex: number;
  route: string;
  routes: string[];
  column: "nav" | "content";
  contentIndex: number;
  railIndex: number;
  colIndex: number;
  $appState: { itineraryCount: number; movieRailSizes: number[]; movieCards: PlayEntry[] };
};

// Sections come from the tenant layout (home.json): each `widget` node that this
// build actually knows (present in CONTENT_WIDGETS) and passes its feature gate
// becomes a nav entry + a view. So a tenant drives nav order/labels/gating and
// which of the build's widgets appear — all from config, no code change. Adding a
// NEW widget TYPE still needs a component + a static template tag (Blits
// precompiles templates → no runtime-generated tags); that's the Blits ceiling.
function buildSections(): Section[] {
  const config = getBootConfig();
  const children = config.layout?.root?.children ?? [];
  return children
    .filter(
      (n) =>
        n.type === "widget" &&
        typeof n.widget === "string" &&
        CONTENT_WIDGETS[n.widget] !== undefined &&
        (!n.feature || isFeatureEnabled(config.features, n.feature)),
    )
    .map((n) => ({ label: n.label ?? (n.widget as string), widget: n.widget as string }));
}

// One player for the app lifetime; the adapter picks avplay (Samsung, needs the
// partner cert + privilege), the Android bridge, or HTML5 (webOS/dev browser).
// ponytail: PROIDIOM-encrypted streams still need DRM setup on avplay and
// Back-to-stop is the only teardown — richer transport controls are a follow-up.
let player: PlayerAdapter | undefined;

function playFocused(s: AppThis): void {
  const card = (s.$appState.movieCards ?? []).find(
    (c) => c.rail === s.railIndex && c.col === s.colIndex,
  );
  if (!card?.url) {
    return;
  }
  player ??= createPlayerAdapter(getBootConfig().platform.platform);
  const drm = (card.drm === "PROIDIOM" || card.drm === "LYNK" ? card.drm : "NONE") as DrmType;
  console.info(`play "${card.title}" [${drm}] -> ${card.url}`);
  player.load(card.url, drm).then(() => player?.play());
}

// Root Blits Application = guest-portal shell. The root is focused by default, so
// its input handlers receive the remote D-pad. Two-column focus WITHOUT child
// focus: `column` says which side owns up/down. left/right cross columns; up/down
// move within the focused column; enter (in the nav column) switches the view.
export default Blits.Application({
  components: { ...contentComponents, SideNav },
  template: `
    <Element w="1920" h="1080" color="$background">
      <SideNav :navIndex="$navIndex" :active="$navActive" :items="$navItems" panel="$panel" accent="$accent" text="$text" />
      <Element x="360">
        <Itinerary :show="$showItinerary" :focusIndex="$contentIndex" :active="$contentActive" background="$background" text="$text" accent="$accent" url="$itineraryUrl" />
        <Movies :show="$showMovies" :active="$contentActive" :railFocus="$railIndex" :colFocus="$colIndex" background="$background" accent="$accent" textMuted="$textMuted" text="$text" url="$moviesUrl" />
      </Element>
    </Element>
  `,
  state() {
    const config = getBootConfig();
    const theme = getTheme(config.theme);
    const sections = buildSections();
    const routes = sections.map((s) => s.widget);
    const navItems: NavItem[] = sections.map((s, i) => ({ label: s.label, y: 260 + i * 88 }));
    return {
      background: theme.colors.background,
      text: theme.colors.text,
      textMuted: theme.colors.textMuted,
      accent: theme.colors.accent,
      panel: theme.colors.surface,
      // Nav + routing come from home.json (see buildSections).
      navItems,
      routes,
      navIndex: 0,
      route: routes[0] ?? "itinerary",
      // "nav" = side menu owns up/down; "content" = the view owns up/down/left/right.
      column: "nav" as "nav" | "content",
      contentIndex: 0, // itinerary row
      railIndex: 0, // movie rail (vertical)
      colIndex: 0, // movie card within rail (horizontal)
      // ponytail: service URLs live in tenant config integrations; services spreads them.
      itineraryUrl: (config.services as unknown as { itineraryUrl?: string }).itineraryUrl ?? "",
      moviesUrl: (config.services as unknown as { moviesUrl?: string }).moviesUrl ?? "",
    };
  },
  computed: {
    showItinerary() {
      return (this as unknown as AppThis).route === "itinerary";
    },
    showMovies() {
      return (this as unknown as AppThis).route === "movies";
    },
    navActive() {
      return (this as unknown as AppThis).column === "nav";
    },
    contentActive() {
      return (this as unknown as AppThis).column === "content";
    },
  },
  input: {
    up() {
      const s = this as unknown as AppThis;
      if (s.column === "nav") {
        s.navIndex = Math.max(0, s.navIndex - 1);
      } else if (s.route === "itinerary") {
        s.contentIndex = Math.max(0, s.contentIndex - 1);
      } else {
        s.railIndex = Math.max(0, s.railIndex - 1);
        s.colIndex = 0;
      }
    },
    down() {
      const s = this as unknown as AppThis;
      if (s.column === "nav") {
        s.navIndex = Math.min(s.routes.length - 1, s.navIndex + 1);
      } else if (s.route === "itinerary") {
        const max = Math.max(0, (s.$appState.itineraryCount ?? 0) - 1);
        s.contentIndex = Math.min(max, s.contentIndex + 1);
      } else {
        const rails = s.$appState.movieRailSizes ?? [];
        s.railIndex = Math.min(Math.max(0, rails.length - 1), s.railIndex + 1);
        s.colIndex = 0;
      }
    },
    left() {
      const s = this as unknown as AppThis;
      // In a movie rail, walk left through cards; at the first card, exit to the menu.
      if (s.column === "content" && s.route === "movies" && s.colIndex > 0) {
        s.colIndex -= 1;
      } else {
        s.column = "nav";
      }
    },
    right() {
      const s = this as unknown as AppThis;
      if (s.column === "nav") {
        // Enter the content column — only where there is something to navigate.
        const hasContent =
          s.route === "itinerary"
            ? (s.$appState.itineraryCount ?? 0) > 0
            : (s.$appState.movieRailSizes ?? []).length > 0;
        if (hasContent) {
          s.column = "content";
        }
      } else if (s.route === "movies") {
        // Walk right within the focused rail.
        const rails = s.$appState.movieRailSizes ?? [];
        const max = Math.max(0, (rails[s.railIndex] ?? 0) - 1);
        s.colIndex = Math.min(max, s.colIndex + 1);
      }
    },
    enter() {
      const s = this as unknown as AppThis;
      if (s.column === "nav") {
        s.route = s.routes[s.navIndex] ?? s.routes[0] ?? "itinerary";
        s.contentIndex = 0;
        s.railIndex = 0;
        s.colIndex = 0;
      } else if (s.route === "movies") {
        // Play the focused movie (avplay on Samsung; HTML5 in the dev browser).
        playFocused(s);
      }
    },
    back() {
      // Stop playback and return to the grid.
      player?.stop();
    },
  },
});
