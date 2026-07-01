import Blits from "@lightningjs/blits";
import { getTheme } from "@x-tv/themes";
import { HelloWorld } from "@x-tv/widgets";
import { getBootConfig } from "./boot-config";

// Root Blits Application. Resolves the active theme (config-driven, per location)
// and passes its tokens down. Caption reads global reactive state (this.$appState).
// Next: a config-driven, feature-gated multi-widget layout engine.
export default Blits.Application({
  components: { HelloWorld },
  template: `
    <Element w="1920" h="1080" color="$background">
      <HelloWorld
        background="$background"
        text="$text"
        textMuted="$textMuted"
        accent="$accent"
      />
    </Element>
  `,
  state() {
    const theme = getTheme(getBootConfig().theme);
    return {
      background: theme.colors.background,
      text: theme.colors.text,
      textMuted: theme.colors.textMuted,
      accent: theme.colors.accent,
    };
  },
});
