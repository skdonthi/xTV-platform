import Blits from "@lightningjs/blits";
import { cclTheme } from "@x-tv/themes";
import { HelloWorld } from "@x-tv/widgets";
import { getBootConfig } from "./boot-config";

// Root Blits Application. For now it renders a Hello World screen so a build
// (.wgt / .ipk / .apk) can be signed and deployed to a real TV to confirm the
// end-to-end pipeline. The caption echoes the baked-in tenant + platform.
// Next: a config-driven, feature-gated multi-widget layout engine.
export default Blits.Application({
  components: { HelloWorld },
  template: `
    <Element w="1920" h="1080" color="$background">
      <HelloWorld background="$background" caption="$caption" />
    </Element>
  `,
  state() {
    const config = getBootConfig();
    return {
      background: cclTheme.colors.background,
      caption: `${config.customer} · ${config.platform.platform} · ${config.platform.id}`,
    };
  },
});
