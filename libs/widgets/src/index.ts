import { createHeroBannerElement } from "./components/hero-banner";

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
