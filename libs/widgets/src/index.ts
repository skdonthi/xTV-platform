import { createHeroBannerElement } from "./components/hero-banner";
import Itinerary from "./components/itinerary.component";
import Movies from "./components/movies.component";

// Blits (canvas) components — the production render path used by the Blits app.
export { default as HeroBanner } from "./components/hero-banner.component";
export { default as HelloWorld } from "./components/hello-world.component";
export { default as SideNav } from "./components/side-nav.component";
export { Itinerary, Movies };

// WIDGET REGISTRY: layout `widget` name (from home.json) → Blits content component.
// The App renders content by looking widgets up here, so adding a new content
// widget is one entry + a home.json reference — no App edit. Compiled per build
// (one tenant's widgets), so per-brand isolation holds. Keys MUST match the
// `widget` values used in customers/<slug>/layouts/home.json.
// biome-ignore lint/suspicious/noExplicitAny: Blits component factory type is opaque.
export const CONTENT_WIDGETS: Record<string, any> = {
  itinerary: Itinerary,
  movies: Movies,
};

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
