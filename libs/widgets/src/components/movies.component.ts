import Blits from "@lightningjs/blits";

// Netflix-style layout constants.
const RAIL_STEP = 448; // rail vertical pitch (title + poster + gap between genres)
const COL_STEP = 224; // card horizontal pitch (poster + gap)
const CARD_TOP = 52; // poster offset below its rail title
const LEFT_PAD = 8; // inset so the focus frame's left edge isn't clipped at x<0
const VIEWPORT_H = 820; // clip window height (matches template)
const VISIBLE_COLS = 6; // cards that fit across the 1500-wide clip window
// Smooth scroll/focus movement — the "rich web UI" feel.
const EASE = { duration: 220, easing: "ease-in-out" };

interface Card {
  id: string;
  title: string;
  poster: string;
  x: number;
  y: number;
}
interface RailLabel {
  title: string;
  y: number;
}
// Flat (rail,col)→playback lookup, published to appState so the root App can
// resolve the focused card's stream URL on Enter.
interface PlayEntry {
  rail: number;
  col: number;
  url: string;
  title: string;
  drm: string; // "PROIDIOM" | "LYNK" | "NONE"
}
interface Rails {
  labels: RailLabel[];
  cards: Card[];
  sizes: number[]; // cards per rail, for focus clamping
  play: PlayEntry[];
}

interface Movie {
  id?: string;
  title?: string;
  poster?: string;
  url?: string;
  encryption?: string; // "PROIDIOM" | "LYNK" | null
  filmGenre?: string;
  categories?: string[];
}

// Bundled sample so the rails always render for the demo when the head-end
// returns an empty catalogue (it toggles in dev). Poster paths resolve against
// the moviesUrl origin like live data. ponytail: reuses one known-good poster
// across cards; swap for per-title art once the dev catalogue is stable.
const SAMPLE_POSTER = "/documents/20117/f5a13634-7e39-dab8-d736-8b03ead4a43d";
// Real sample stream from the head-end payload — proves the Enter→player path.
const SAMPLE_URL = "http://10.100.0.16/vod/aida/Content/1490949/1/2/0057488.MPG";
const FALLBACK: Movie[] = [
  {
    id: "s1",
    title: "American Made",
    poster: SAMPLE_POSTER,
    url: SAMPLE_URL,
    filmGenre: "Thriller & Crime",
  },
  {
    id: "s2",
    title: "The Departed",
    poster: SAMPLE_POSTER,
    url: SAMPLE_URL,
    filmGenre: "Thriller & Crime",
  },
  {
    id: "s3",
    title: "Sicario",
    poster: SAMPLE_POSTER,
    url: SAMPLE_URL,
    filmGenre: "Thriller & Crime",
  },
  {
    id: "s4",
    title: "Home Again",
    poster: SAMPLE_POSTER,
    url: SAMPLE_URL,
    filmGenre: "Comedy & Drama",
  },
  {
    id: "s5",
    title: "The Intern",
    poster: SAMPLE_POSTER,
    url: SAMPLE_URL,
    filmGenre: "Comedy & Drama",
  },
  {
    id: "s6",
    title: "Mad Max: Fury Road",
    poster: SAMPLE_POSTER,
    url: SAMPLE_URL,
    filmGenre: "Action",
  },
  { id: "s7", title: "John Wick", poster: SAMPLE_POSTER, url: SAMPLE_URL, filmGenre: "Action" },
];

const EMPTY: Rails = { labels: [], cards: [], sizes: [], play: [] };

// Group the flat movie list into genre rails (filmGenre → one rail), keeping the
// order the head-end returned, then lay everything out with ABSOLUTE positions so
// the template can render flat sibling loops (Blits nested :for is unreliable).
// Poster paths are relative to the API host → resolved against the moviesUrl
// origin (no hardcoded host).
function buildRails(movies: Movie[], origin: string): Rails {
  const order: string[] = [];
  const byGenre = new Map<string, Movie[]>();
  for (const m of movies) {
    const genre = m.filmGenre || m.categories?.[0] || "Featured";
    if (!byGenre.has(genre)) {
      byGenre.set(genre, []);
      order.push(genre);
    }
    byGenre.get(genre)?.push(m);
  }
  const labels: RailLabel[] = [];
  const cards: Card[] = [];
  const sizes: number[] = [];
  const play: PlayEntry[] = [];
  order.forEach((genre, i) => {
    const railY = i * RAIL_STEP;
    labels.push({ title: genre, y: railY });
    const items = byGenre.get(genre) ?? [];
    sizes.push(items.length);
    items.forEach((m, j) => {
      cards.push({
        id: `${i}-${m.id ?? m.title ?? j}`,
        title: m.title ?? "",
        poster: m.poster ? `${origin}${m.poster}` : "",
        x: LEFT_PAD + j * COL_STEP,
        y: railY + CARD_TOP,
      });
      play.push({
        rail: i,
        col: j,
        url: m.url ?? "",
        title: m.title ?? "",
        drm: m.encryption || "NONE",
      });
    });
  });
  return { labels, cards, sizes, play };
}

async function loadRails(url: string): Promise<Rails> {
  if (!url) {
    return EMPTY;
  }
  const origin = new URL(url).origin;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data?: Movie[] };
    const movies = json.data && json.data.length > 0 ? json.data : FALLBACK;
    const rails = buildRails(movies, origin);
    console.info(`Movies: ${movies.length} titles → ${rails.labels.length} rails`);
    return rails;
  } catch (error) {
    console.warn("Movies: get-movies fetch failed, using bundled sample.", error);
    return buildRails(FALLBACK, origin);
  }
}

export default Blits.Component("Movies", {
  template: `
    <Element w="1560" h="1080" color="$background">
      <Text content="Movies" font="Tempo Std" x="60" y="40" size="56" color="$accent" />
      <!-- FIXED clip window; the content group pans inside it (vertical rail scroll
           + horizontal scroll of the focused rail) so focus never leaves view. -->
      <Element x="60" y="200" clipping="true" w="1500" h="820">
        <Element :x="$contentX" :y="$contentY">
          <Element w="208" h="308" :x="$hlX" :y="$hlY" color="$accent" :alpha="$hlAlpha" />
          <Text
            :for="(label, i) in $labels"
            key="$label.title"
            content="$label.title"
            font="Open Sans"
            x="8"
            :y="$label.y"
            size="30"
            color="$textMuted"
          />
          <Element :for="(card, j) in $cards" key="$card.id" :x="$card.x" :y="$card.y">
            <Element w="200" h="300" color="#16283b" />
            <Element w="200" h="300" :src="$card.poster" />
            <Text content="$card.title" font="Open Sans" x="0" y="308" size="22" color="$text" maxwidth="200" maxlines="1" textoverflow="..." />
          </Element>
        </Element>
      </Element>
    </Element>
  `,
  props: {
    background: {},
    accent: {},
    textMuted: {},
    text: {},
    url: {},
    active: {},
    railFocus: {},
    colFocus: {},
  },
  state() {
    return { labels: [] as RailLabel[], cards: [] as Card[] };
  },
  computed: {
    // Horizontal scroll of the focused rail: keep the focused card in view once
    // it passes the last visible column. Whole content group pans (Blits renders
    // rails flat); switching rails resets colFocus → grid returns to the left.
    contentX() {
      const colFocus = (this as unknown as { colFocus: number }).colFocus;
      const scroll = Math.max(0, colFocus - (VISIBLE_COLS - 1)) * COL_STEP;
      return { value: -scroll, transition: EASE };
    },
    // Vertical rail scroll, CLAMPED so the last rails fill from the bottom instead
    // of over-scrolling into empty space (was: focus landing below real content).
    contentY() {
      const s = this as unknown as { railFocus: number; labels: RailLabel[] };
      const maxScroll = Math.max(0, s.labels.length * RAIL_STEP - VIEWPORT_H);
      const scroll = Math.min(s.railFocus * RAIL_STEP, maxScroll);
      return { value: -scroll, transition: EASE };
    },
    hlX() {
      return {
        value: LEFT_PAD + (this as unknown as { colFocus: number }).colFocus * COL_STEP - 4,
        transition: EASE,
      };
    },
    hlY() {
      return {
        value: (this as unknown as { railFocus: number }).railFocus * RAIL_STEP + CARD_TOP - 4,
        transition: EASE,
      };
    },
    // Bright accent frame behind the focused poster, only while focused.
    hlAlpha() {
      return { value: (this as unknown as { active: boolean }).active ? 0.9 : 0, transition: EASE };
    },
  },
  hooks: {
    async ready() {
      await refresh(this as unknown as MoviesThis, (this as unknown as MoviesThis).url);
    },
  },
  // Re-fetch when the data URL changes on hot-apply (config.updated → new endpoint).
  watch: {
    async url(next: string) {
      await refresh(this as unknown as MoviesThis, next);
    },
  },
});

interface MoviesThis {
  url: string;
  labels: RailLabel[];
  cards: Card[];
  $appState: { movieRailSizes: number[]; movieCards: PlayEntry[] };
}

async function refresh(self: MoviesThis, url: string): Promise<void> {
  const rails = await loadRails(url);
  self.labels = rails.labels;
  self.cards = rails.cards;
  // Publish per-rail counts (focus clamping) + the (rail,col)→stream lookup
  // (Enter→player) so the root App owns input without owning movie data.
  self.$appState.movieRailSizes = rails.sizes;
  self.$appState.movieCards = rails.play;
}
