import Blits from "@lightningjs/blits";

// Shape of the global reactive state seeded in core (Blits appState plugin).
interface AppState {
  customer: string;
  platform: string;
  locale: string;
  theme: string;
}

// Hello World screen, themed. Headline in the theme's text color, caption in
// muted, and a brand accent bar — the one bold mark — in the theme accent.
// Colors arrive as props from the resolved theme; caption reads appState so an
// on-device deploy confirms the baked-in tenant/platform/theme.
export default Blits.Component("HelloWorld", {
  template: `
    <Element w="1920" h="1080" color="$background">
      <Text
        content="Hello World"
        font="Tempo Std"
        x="960" y="430"
        mount="{x: 0.5, y: 0.5}"
        size="120"
        color="$text"
      />
      <Element w="240" h="8" x="960" y="520" mount="{x: 0.5}" color="$accent" />
      <Text
        content="$caption"
        font="Open Sans"
        x="960" y="600"
        mount="{x: 0.5, y: 0.5}"
        size="34"
        color="$textMuted"
      />
    </Element>
  `,
  props: { background: {}, text: {}, textMuted: {}, accent: {} },
  computed: {
    caption(): string {
      const app = (this as unknown as { $appState: AppState }).$appState;
      return `${app.customer} / ${app.platform} / ${app.theme}`;
    },
  },
});
