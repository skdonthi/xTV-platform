import Blits from "@lightningjs/blits";
import { cclTheme } from "@x-tv/themes";
import { HelloWorld } from "@x-tv/widgets";

// Root Blits Application. Renders the Hello World screen; its caption reads
// global reactive state (this.$appState, seeded in core). Next: a config-driven,
// feature-gated multi-widget layout engine.
export default Blits.Application({
  components: { HelloWorld },
  template: `
    <Element w="1920" h="1080" color="$background">
      <HelloWorld background="$background" />
    </Element>
  `,
  state() {
    return {
      background: cclTheme.colors.background,
    };
  },
});
