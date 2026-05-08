import type { XmmApiConfig, XmmContentItemDto, XmmLayoutDto } from "./xmm-api.types";

export interface XmmApiClient {
  getHomeContent(): Promise<XmmContentItemDto[]>;
  getActiveLayout(customerId: string): Promise<XmmLayoutDto>;
}

export function createXmmApiClient(config: XmmApiConfig): XmmApiClient {
  return {
    getHomeContent() {
      return request<XmmContentItemDto[]>(config, "/content/home");
    },
    getActiveLayout(customerId) {
      return request<XmmLayoutDto>(config, `/customers/${customerId}/layouts/active`);
    },
  };
}

async function request<TResponse>(config: XmmApiConfig, path: string): Promise<TResponse> {
  const response = await fetch(new URL(path, config.baseUrl), {
    headers: {
      accept: "application/json",
      "x-tenant-id": config.tenantId,
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`XMM API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TResponse>;
}
