import type { LiferayApiClient } from "@x-tv/integrations/liferay-api";
import type { XmmApiClient } from "@x-tv/integrations/xmm-api";
import type { CustomerLayout } from "@x-tv/layout";
import type { GatewayRuntimeConfig, LayoutGateway } from "./service-gateway.types";

export function createLayoutGateway(dependencies: {
  config: GatewayRuntimeConfig;
  xmmApi?: XmmApiClient;
  liferayApi?: LiferayApiClient;
}): LayoutGateway {
  return {
    async getActiveLayout(fallbackLayout) {
      // Remote layout is an OVERRIDE; the bundled layout is the fallback. A TV
      // must boot even when the head-end is unreachable — never let a failed
      // fetch crash the app. Any remote error → bundled layout + a warning.
      try {
        if (dependencies.config.layoutSource === "xmm") {
          const client = requireClient(dependencies.xmmApi, "XMM");
          const layout = await client.getActiveLayout(dependencies.config.customerId);
          return assertCustomerLayout(layout.payload);
        }

        if (dependencies.config.layoutSource === "liferay") {
          const client = requireClient(dependencies.liferayApi, "Liferay");
          const layout = await client.getLayoutContent("ACTIVE_TV_LAYOUT");
          const payloadField = layout.contentFields.find((field) => field.name === "layoutJson");
          const rawLayout = payloadField?.contentFieldValue.data;

          if (!rawLayout) {
            throw new Error("Liferay layout response did not include layoutJson.");
          }

          return assertCustomerLayout(JSON.parse(rawLayout) as unknown);
        }
      } catch (error) {
        console.warn("Remote layout fetch failed; using bundled layout.", error);
        return fallbackLayout;
      }

      return fallbackLayout;
    },
  };
}

function assertCustomerLayout(value: unknown): CustomerLayout {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.version !== "number") {
    throw new Error("Remote layout payload is not a valid xTV layout.");
  }

  if (!isRecord(value.root) || typeof value.root.id !== "string") {
    throw new Error("Remote layout payload is missing a valid root node.");
  }

  return value as unknown as CustomerLayout;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireClient<TClient>(client: TClient | undefined, sourceName: string): TClient {
  if (!client) {
    throw new Error(`${sourceName} client is required for the selected layout source.`);
  }

  return client;
}
