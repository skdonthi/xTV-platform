import type { LiferayApiClient } from "@x-tv/integrations/liferay-api";
import type { XmmApiClient } from "@x-tv/integrations/xmm-api";
import type { ContentGateway, ContentItem, GatewayRuntimeConfig } from "./service-gateway.types";

export function createContentGateway(dependencies: {
  config: GatewayRuntimeConfig;
  xmmApi?: XmmApiClient;
  liferayApi?: LiferayApiClient;
}): ContentGateway {
  return {
    async getHomeContent() {
      if (dependencies.config.contentSource === "xmm") {
        const client = requireClient(dependencies.xmmApi, "XMM");
        return (await client.getHomeContent()).map((item): ContentItem => ({ ...item }));
      }

      if (dependencies.config.contentSource === "liferay") {
        const client = requireClient(dependencies.liferayApi, "Liferay");
        const contents = await client.getStructuredContents("HOME_CONTENT");

        return contents.map((item): ContentItem => {
          const imageUrl = item.image?.url;

          return {
            id: item.id,
            title: item.title,
            ...(item.description ? { playbackUrl: item.description } : {}),
            ...(imageUrl ? { imageUrl } : {}),
          };
        });
      }

      return [];
    },
  };
}

function requireClient<TClient>(client: TClient | undefined, sourceName: string): TClient {
  if (!client) {
    throw new Error(`${sourceName} client is required for the selected content source.`);
  }

  return client;
}
