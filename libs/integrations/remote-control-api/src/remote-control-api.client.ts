import type {
  RemoteControlApiConfig,
  RemoteControlCommandDto,
  RemoteControlSessionDto,
} from "./remote-control-api.types";

export interface RemoteControlApiClient {
  createPairingSession(): Promise<RemoteControlSessionDto>;
  getPendingCommands(sessionId: string): Promise<RemoteControlCommandDto[]>;
}

export function createRemoteControlApiClient(
  config: RemoteControlApiConfig,
): RemoteControlApiClient {
  return {
    createPairingSession() {
      return request<RemoteControlSessionDto>(config, "/remote-control/sessions", {
        method: "POST",
        body: JSON.stringify({ deviceId: config.deviceId }),
      });
    },
    getPendingCommands(sessionId) {
      return request<RemoteControlCommandDto[]>(
        config,
        `/remote-control/sessions/${sessionId}/commands`,
      );
    },
  };
}

async function request<TResponse>(
  config: RemoteControlApiConfig,
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const response = await fetch(new URL(path, config.baseUrl), {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-device-id": config.deviceId,
      ...(config.pairingToken ? { authorization: `Bearer ${config.pairingToken}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Remote Control API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TResponse>;
}
