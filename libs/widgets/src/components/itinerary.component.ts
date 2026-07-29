import Blits from "@lightningjs/blits";

// Smooth movement for the focus highlight — makes D-pad navigation feel like a
// rich web UI rather than snapping.
const EASE = { duration: 200, easing: "ease-in-out" };

interface PortRow {
  dayLabel: string; // "Day 1"
  label: string; // "Miami / Nov 14"
  y: number;
}

// Bundled fallback so the view always renders even if the head-end is unreachable.
const FALLBACK: PortRow[] = [
  "Miami / Nov 14",
  "Fun Day at Sea / Nov 15",
  "Princess Cays / Nov 16",
  "Nassau / Nov 17",
  "Celebration Key / Nov 18",
  "Miami / Nov 19",
].map((label, i) => ({ dayLabel: `Day ${i + 1}`, label, y: i * 150 }));

interface Port {
  day?: string;
  name?: string;
  imageUrl?: string;
  dateLocalized?: { shortdate?: string };
}

async function loadItinerary(url: string): Promise<PortRow[]> {
  if (!url) {
    return FALLBACK;
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data?: { ports?: Port[] } };
    const ports = json.data?.ports ?? [];
    const rows = ports.map((p, i) => ({
      dayLabel: `Day ${p.day ?? i + 1}`,
      label: `${p.name ?? ""} / ${p.dateLocalized?.shortdate ?? ""}`,
      y: i * 150,
    }));
    console.info(`Itinerary: loaded ${rows.length} ports from Liferay API`);
    return rows.length ? rows : FALLBACK;
  } catch (error) {
    console.warn("Itinerary: Liferay API fetch failed, using bundled sample.", error);
    return FALLBACK;
  }
}

export default Blits.Component("Itinerary", {
  template: `
    <Element w="1560" h="1080" color="$background">
      <Text content="Itinerary" font="Tempo Std" x="60" y="60" size="72" color="$accent" />
      <Element x="60" y="200">
        <Element w="1440" h="130" x="-8" :y="$highlightY" color="$accent" :alpha="$highlightAlpha" />
        <Element :for="(port, index) in $ports" key="$port.y" :y="$port.y">
          <Element w="220" h="124" color="$accent" alpha="0.18" />
          <Text content="$port.dayLabel" font="Tempo Std" x="0" y="38" maxwidth="220" align="center" size="48" color="$accent" />
          <Text content="$port.label" font="Open Sans" x="252" y="42" size="40" color="$text" />
        </Element>
      </Element>
    </Element>
  `,
  props: { background: {}, text: {}, accent: {}, url: {}, focusIndex: {}, active: {} },
  state() {
    return { ports: [] as PortRow[] };
  },
  computed: {
    // Highlight the focused day, only while the content column holds focus.
    highlightY() {
      return {
        value: (this as unknown as { focusIndex: number }).focusIndex * 150 - 3,
        transition: EASE,
      };
    },
    highlightAlpha() {
      return {
        value: (this as unknown as { active: boolean }).active ? 0.28 : 0,
        transition: EASE,
      };
    },
  },
  hooks: {
    async ready() {
      await refresh(this as unknown as ItineraryThis, (this as unknown as ItineraryThis).url);
    },
  },
  // Re-fetch when the data URL changes on hot-apply (config.updated → new endpoint).
  watch: {
    async url(next: string) {
      await refresh(this as unknown as ItineraryThis, next);
    },
  },
});

interface ItineraryThis {
  url: string;
  ports: PortRow[];
  $appState: { itineraryCount: number };
}

async function refresh(self: ItineraryThis, url: string): Promise<void> {
  self.ports = await loadItinerary(url);
  // Publish the row count so the root App can clamp Down within the list.
  self.$appState.itineraryCount = self.ports.length;
}
