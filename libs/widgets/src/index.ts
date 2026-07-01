import { createHeroBannerElement } from "./components/hero-banner";

// Blits (canvas) components — the production render path used by the Blits app.
export { default as HeroBanner } from "./components/hero-banner.component";
export { default as HelloWorld } from "./components/hello-world.component";

// NOTE: the DOM WidgetDefinition/registry/layout path below is retained (still
// consumed by @x-tv/layout + @x-tv/widget-registry types) but is NOT the render
// path anymore. It will be reworked into a Blits-native dynamic layout engine.
export interface WidgetRenderInput {
  id: string;
  props: Record<string, unknown>;
  context: {
    customer: string;
    locale: string;
    platform: string;
    theme: string;
    features: Record<string, boolean>;
  };
}

export interface WidgetDefinition {
  type: string;
  render(input: WidgetRenderInput): HTMLElement;
}

export const HeroBannerWidget: WidgetDefinition = {
  type: "hero-banner",
  render: createHeroBannerElement,
};
