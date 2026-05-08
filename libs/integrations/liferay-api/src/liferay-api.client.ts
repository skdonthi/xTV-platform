import type { LiferayApiConfig, LiferayContentDto, LiferayLayoutDto } from "./liferay-api.types";

export interface LiferayApiClient {
  getStructuredContents(structureKey: string): Promise<LiferayContentDto[]>;
  getLayoutContent(layoutKey: string): Promise<LiferayLayoutDto>;
}

export function createLiferayApiClient(config: LiferayApiConfig): LiferayApiClient {
  return {
    getStructuredContents(structureKey) {
      return request<LiferayContentDto[]>(
        config,
        `/o/headless-delivery/v1.0/sites/${config.siteId}/structured-contents?filter=contentStructureKey eq '${structureKey}'`,
      );
    },
    getLayoutContent(layoutKey) {
      return request<LiferayLayoutDto>(
        config,
        `/o/headless-delivery/v1.0/sites/${config.siteId}/structured-contents/by-key/${layoutKey}`,
      );
    },
  };
}

async function request<TResponse>(config: LiferayApiConfig, path: string): Promise<TResponse> {
  const response = await fetch(new URL(path, config.baseUrl), {
    headers: {
      accept: "application/json",
      ...(config.accessToken ? { authorization: `Bearer ${config.accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Liferay API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TResponse>;
}
