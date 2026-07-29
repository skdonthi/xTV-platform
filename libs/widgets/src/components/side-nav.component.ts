import Blits from "@lightningjs/blits";

// Smooth movement/fade for the selection bar.
const EASE = { duration: 200, easing: "ease-in-out" };

// Guest-portal side navigation — display only. Items are supplied by the root App
// (derived from the tenant layout / home.json); the highlighted item is driven by
// the `navIndex` prop.
interface NavItem {
  label: string;
  y: number;
}

export default Blits.Component("SideNav", {
  template: `
    <Element w="360" h="1080" :color="$panel">
      <Element w="320" h="72" x="20" :y="$barY" :color="$accent" :alpha="$barAlpha" />
      <Text
        :for="(item, index) in $items"
        key="$item.label"
        content="$item.label"
        font="Open Sans"
        x="52"
        :y="$item.y"
        size="36"
        :color="$text"
      />
    </Element>
  `,
  props: { panel: {}, accent: {}, text: {}, navIndex: {}, active: {}, items: {} },
  computed: {
    barY() {
      const s = this as unknown as { items: NavItem[]; navIndex: number };
      const y = (s.items[s.navIndex]?.y ?? 260) - 16;
      return { value: y, transition: EASE };
    },
    // Dim the selection bar when focus has moved to the content column.
    barAlpha() {
      return {
        value: (this as unknown as { active: boolean }).active ? 0.9 : 0.3,
        transition: EASE,
      };
    },
  },
});
