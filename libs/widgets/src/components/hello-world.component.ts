import Blits from "@lightningjs/blits";

// Shape of the global reactive state seeded in core (Blits appState plugin).
interface AppState {
  customer: string;
  platform: string;
  locale: string;
}

// Minimal Hello World screen. The headline uses the tenant brand font; the
// caption is derived from global reactive state (this.$appState) rather than a
// passed prop — so an on-device deploy confirms the baked-in tenant/platform.
export default Blits.Component("HelloWorld", {
  template: `
    <Element w="1920" h="1080" color="$background">
      <Text
        content="Hello World"
        font="Tempo Std"
        x="960" y="470"
        mount="{x: 0.5, y: 0.5}"
        size="120"
        color="#ffffff"
      />
      <Text
        content="$caption"
        font="Open Sans"
        x="960" y="620"
        mount="{x: 0.5, y: 0.5}"
        size="34"
        color="#9db1c7"
      />
    </Element>
  `,
  props: ["background"],
  computed: {
    caption(): string {
      const app = (this as unknown as { $appState: AppState }).$appState;
      return `${app.customer} · ${app.platform} · ${app.locale}`;
    },
  },
});
