import Blits from "@lightningjs/blits";
import { type PlayerAdapter, createPlayerAdapter } from "@x-tv/player";
import { getTheme } from "@x-tv/themes";
import { Itinerary, Movies, SideNav } from "@x-tv/widgets";
import { getBootConfig } from "./boot-config";

const ROUTES = ["home", "movies"];

interface PlayEntry {
  rail: number;
  col: number;
  url: string;
  title: string;
}

type AppThis = {
  navIndex: number;
  route: string;
  column: "nav" | "content";
  contentIndex: number;
  railIndex: number;
  colIndex: number;
  $appState: { itineraryCount: number; movieRailSizes: number[]; movieCards: PlayEntry[] };
};

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
  console.info(`play "${card.title}" -> ${card.url}`);
  player.load(card.url).then(() => player?.play());
}

// Root Blits Application = guest-portal shell. The root is focused by default, so
// its input handlers receive the remote D-pad. Two-column focus WITHOUT child
// focus: `column` says which side owns up/down. left/right cross columns; up/down
// move within the focused column; enter (in the nav column) switches the view.
// SideNav + content dim when they don't hold focus. Theme + itinerary URL are
// config-driven.
export default Blits.Application({
  components: { Itinerary, Movies, SideNav },
  template: `
    <Element w="1920" h="1080" color="$background">
      <SideNav :navIndex="$navIndex" :active="$navActive" panel="$panel" accent="$accent" text="$text" />
      <Element x="360">
        <Itinerary :show="$showHome" :focusIndex="$contentIndex" :active="$contentActive" background="$background" text="$text" accent="$accent" url="$itineraryUrl" />
        <Movies :show="$showMovies" :active="$contentActive" :railFocus="$railIndex" :colFocus="$colIndex" background="$background" accent="$accent" textMuted="$textMuted" text="$text" url="$moviesUrl" />
      </Element>
    </Element>
  `,
  state() {
    const config = getBootConfig();
    const theme = getTheme(config.theme);
    return {
      background: theme.colors.background,
      text: theme.colors.text,
      textMuted: theme.colors.textMuted,
      accent: theme.colors.accent,
      panel: theme.colors.surface,
      navIndex: 0,
      route: "home",
      // "nav" = side menu owns up/down; "content" = the view owns up/down/left/right.
      column: "nav" as "nav" | "content",
      contentIndex: 0, // itinerary row (home)
      railIndex: 0, // movie rail (movies, vertical)
      colIndex: 0, // movie card within rail (movies, horizontal)
      // ponytail: service URLs live in tenant config integrations; services spreads them.
      itineraryUrl: (config.services as unknown as { itineraryUrl?: string }).itineraryUrl ?? "",
      moviesUrl: (config.services as unknown as { moviesUrl?: string }).moviesUrl ?? "",
    };
  },
  computed: {
    showHome() {
      return (this as unknown as AppThis).route === "home";
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
      } else if (s.route === "home") {
        s.contentIndex = Math.max(0, s.contentIndex - 1);
      } else {
        s.railIndex = Math.max(0, s.railIndex - 1);
        s.colIndex = 0;
      }
    },
    down() {
      const s = this as unknown as AppThis;
      if (s.column === "nav") {
        s.navIndex = Math.min(ROUTES.length - 1, s.navIndex + 1);
      } else if (s.route === "home") {
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
          s.route === "home"
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
        s.route = ROUTES[s.navIndex] ?? "home";
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
