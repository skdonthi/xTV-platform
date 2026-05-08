import { HeroBannerWidget, type WidgetDefinition } from "@x-tv/widgets";

export interface WidgetRegistry {
  register(widget: WidgetDefinition): void;
  resolve(widgetType: string): WidgetDefinition;
  list(): WidgetDefinition[];
}

export function createWidgetRegistry(widgets: WidgetDefinition[] = []): WidgetRegistry {
  const index = new Map<string, WidgetDefinition>();

  const registry: WidgetRegistry = {
    register(widget) {
      if (index.has(widget.type)) {
        throw new Error(`Widget "${widget.type}" is already registered.`);
      }

      index.set(widget.type, widget);
    },
    resolve(widgetType) {
      const widget = index.get(widgetType);

      if (!widget) {
        throw new Error(`Widget "${widgetType}" is not registered.`);
      }

      return widget;
    },
    list() {
      return [...index.values()];
    },
  };

  for (const widget of widgets) {
    registry.register(widget);
  }

  return registry;
}

export function createDefaultWidgetRegistry(): WidgetRegistry {
  return createWidgetRegistry([HeroBannerWidget]);
}
