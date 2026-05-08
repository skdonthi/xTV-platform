import type { NavigationEngine } from "@x-tv/navigation";
import type { WidgetRegistry } from "@x-tv/widget-registry";

export type LayoutNodeType = "screen" | "row" | "column" | "widget";

export interface LayoutNode {
  id: string;
  type: LayoutNodeType;
  widget?: string;
  props?: Record<string, unknown>;
  children?: LayoutNode[];
}

export interface CustomerLayout {
  id: string;
  version: number;
  root: LayoutNode;
}

export interface LayoutRenderContext {
  customer: string;
  locale: string;
  platform: string;
  theme: string;
  features: Record<string, boolean>;
}

export interface LayoutRenderer {
  render(layout: CustomerLayout, context: LayoutRenderContext): Promise<void>;
}

export function createLayoutRenderer(dependencies: {
  registry: WidgetRegistry;
  navigation: NavigationEngine;
}): LayoutRenderer {
  return {
    async render(layout, context) {
      const root = document.querySelector("#app");

      if (!root) {
        throw new Error("xTV platform root element #app was not found.");
      }

      root.innerHTML = "";
      root.appendChild(renderNode(layout.root, dependencies.registry, context));
      dependencies.navigation.attach(root);
    },
  };
}

function renderNode(
  node: LayoutNode,
  registry: WidgetRegistry,
  context: LayoutRenderContext,
): HTMLElement {
  if (node.type === "widget") {
    if (!node.widget) {
      throw new Error(`Layout widget node "${node.id}" is missing widget key.`);
    }

    const widget = registry.resolve(node.widget);
    return widget.render({
      id: node.id,
      props: node.props ?? {},
      context,
    });
  }

  const element = document.createElement("section");
  element.dataset.layoutId = node.id;
  element.dataset.layoutType = node.type;
  element.className = `xtv-layout xtv-layout-${node.type}`;

  for (const child of node.children ?? []) {
    element.appendChild(renderNode(child, registry, context));
  }

  return element;
}
