import { type LiferayApiConfig, createLiferayApiClient } from "@x-tv/integrations/liferay-api";
import {
  type RemoteControlApiConfig,
  createRemoteControlApiClient,
} from "@x-tv/integrations/remote-control-api";
import { type XmmApiConfig, createXmmApiClient } from "@x-tv/integrations/xmm-api";
import { createContentGateway } from "./content.gateway";
import { createLayoutGateway } from "./layout.gateway";
import { createRemoteControlGateway } from "./remote-control.gateway";
import type {
  ContentGateway,
  GatewayRuntimeConfig,
  LayoutGateway,
  RemoteControlGateway,
} from "./service-gateway.types";

export interface ServiceGatewayConfig {
  runtime: GatewayRuntimeConfig;
  xmmApi?: XmmApiConfig;
  liferayApi?: LiferayApiConfig;
  remoteControlApi?: RemoteControlApiConfig;
}

export interface ServiceGateway {
  content: ContentGateway;
  layout: LayoutGateway;
  remoteControl: RemoteControlGateway;
}

export function createServiceGateway(config: ServiceGatewayConfig): ServiceGateway {
  const xmmApi = config.xmmApi ? createXmmApiClient(config.xmmApi) : undefined;
  const liferayApi = config.liferayApi ? createLiferayApiClient(config.liferayApi) : undefined;
  const remoteControlApi = config.remoteControlApi
    ? createRemoteControlApiClient(config.remoteControlApi)
    : undefined;

  return {
    content: createContentGateway({
      config: config.runtime,
      xmmApi,
      liferayApi,
    }),
    layout: createLayoutGateway({
      config: config.runtime,
      xmmApi,
      liferayApi,
    }),
    remoteControl: createRemoteControlGateway({
      remoteControlApi,
    }),
  };
}
