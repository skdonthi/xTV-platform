import Blits from "@lightningjs/blits";
import type { CustomerLayout } from "@x-tv/layout";
import { cclTheme } from "@x-tv/themes";
import { HeroBanner } from "@x-tv/widgets";
import { getBootConfig } from "./boot-config";

// Root Blits Application. Reads the resolved tenant config once and renders the
// hero from the active layout. This is the foundation: a single known widget.
// The fully config-driven, feature-gated, multi-widget Blits layout engine
// (porting @x-tv/layout to resolve widgets by type) is the next step.
export default Blits.Application({
  components: { HeroBanner },
  template: `
    <Element w="1920" h="1080" color="$background">
      <HeroBanner title="$title" subtitle="$subtitle" background="$background" />
    </Element>
  `,
  state() {
    const config = getBootConfig();
    const hero = findHeroProps(config.layout);
    return {
      title: hero.title,
      subtitle: hero.subtitle,
      background: cclTheme.colors.background,
    };
  },
});

function findHeroProps(layout: CustomerLayout): { title: string; subtitle: string } {
  const node = layout.root.children?.find((child) => child.widget === "hero-banner");
  const props = (node?.props ?? {}) as { title?: string; subtitle?: string };
  return { title: props.title ?? "", subtitle: props.subtitle ?? "" };
}
