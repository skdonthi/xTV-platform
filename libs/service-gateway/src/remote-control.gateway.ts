import type { RemoteControlApiClient } from "@x-tv/integrations/remote-control-api";
import type { RemoteControlGateway } from "./service-gateway.types";

export function createRemoteControlGateway(dependencies: {
  remoteControlApi?: RemoteControlApiClient;
}): RemoteControlGateway {
  return {
    async createPairingSession() {
      if (!dependencies.remoteControlApi) {
        throw new Error("Remote control API client is required to create a pairing session.");
      }

      return dependencies.remoteControlApi.createPairingSession();
    },
  };
}
