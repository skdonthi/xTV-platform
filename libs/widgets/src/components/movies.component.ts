import Blits from "@lightningjs/blits";

// Netflix-style layout constants.
const RAIL_STEP = 384; // rail vertical pitch (title + poster + gap)
const COL_STEP = 224; // card horizontal pitch (poster + gap)
const CARD_TOP = 52; // poster offset below its rail title
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
        x: j * COL_STEP,
        y: railY + CARD_TOP,
      });
      play.push({ rail: i, col: j, url: m.url ?? "", title: m.title ?? "" });
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
      <Element x="60" :y="$railsY" clipping="true" w="1500" h="860">
        <Element w="208" h="308" :x="$hlX" :y="$hlY" color="$accent" :alpha="$hlAlpha" />
        <Text
          :for="(label, i) in $labels"
          key="$label.title"
          content="$label.title"
          font="Open Sans"
          x="0"
          :y="$label.y"
          size="30"
          color="$textMuted"
        />
        <Element :for="(card, j) in $cards" key="$card.id" :x="$card.x" :y="$card.y">
          <Element w="200" h="300" color="#16283b" :src="$card.poster" />
          <Text content="$card.title" font="Open Sans" x="0" y="308" size="22" color="$text" w="200" />
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
    // Vertical scroll: keep the focused rail pinned near the top (animated).
    railsY() {
      return {
        value: 200 - (this as unknown as { railFocus: number }).railFocus * RAIL_STEP,
        transition: EASE,
      };
    },
    hlX() {
      return {
        value: (this as unknown as { colFocus: number }).colFocus * COL_STEP - 4,
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
      const self = this as unknown as {
        url: string;
        labels: RailLabel[];
        cards: Card[];
        $appState: { movieRailSizes: number[]; movieCards: PlayEntry[] };
      };
      const rails = await loadRails(self.url);
      self.labels = rails.labels;
      self.cards = rails.cards;
      // Publish per-rail counts (focus clamping) + the (rail,col)→stream lookup
      // (Enter→player) so the root App owns input without owning movie data.
      self.$appState.movieRailSizes = rails.sizes;
      self.$appState.movieCards = rails.play;
    },
  },
});
