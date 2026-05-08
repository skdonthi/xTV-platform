import type { CustomerLayout } from "@x-tv/layout";
import type { ServiceGatewayConfig } from "@x-tv/service-gateway";
import demoHotelIntegrations from "../../../customers/demo-hotel/config/integrations.json";
import demoHotelRuntime from "../../../customers/demo-hotel/config/runtime.json";
import demoHotelLayout from "../../../customers/demo-hotel/layouts/home.json";
import androidTv12 from "../../../platforms/android/profiles/android-tv-12.json";
import webos6 from "../../../platforms/lg/profiles/webos6.json";
import tizen6 from "../../../platforms/samsung/profiles/tizen6.json";

export interface PlatformProfile {
  id: string;
  platform: string;
  capabilities: Record<string, boolean | string | number>;
}

export interface RuntimeConfig {
  customer: string;
  locale: string;
  theme: string;
  features: Record<string, boolean>;
  diagnostics: {
    enabled: boolean;
    pin: string;
    pinTimeoutMs: number;
    developerShortcuts: boolean;
  };
  layout: CustomerLayout;
  platform: PlatformProfile;
  services: ServiceGatewayConfig;
}

export interface RuntimeConfigLoader {
  load(): Promise<RuntimeConfig>;
}

const customerAliases: Record<string, string> = {
  AIDA: "demo-hotel",
  DEMO_HOTEL: "demo-hotel",
  "demo-hotel": "demo-hotel",
};

const platformProfiles: Record<string, PlatformProfile> = {
  tizen6,
  webos6,
  "android-tv-12": androidTv12,
};

export function createRuntimeConfigLoader(options: {
  platformId: string;
  defaultProfile: string;
}): RuntimeConfigLoader {
  return {
    async load() {
      const requestedCustomer = import.meta.env.VITE_XTV_CUSTOMER ?? "demo-hotel";
      const requestedProfile = import.meta.env.VITE_XTV_PROFILE ?? options.defaultProfile;
      const customer = customerAliases[requestedCustomer] ?? requestedCustomer;
      const profile = platformProfiles[requestedProfile];

      if (!profile) {
        throw new Error(`Platform profile "${requestedProfile}" is not configured.`);
      }

      if (profile.platform !== options.platformId) {
        throw new Error(
          `Profile "${requestedProfile}" belongs to "${profile.platform}", not "${options.platformId}".`,
        );
      }

      return {
        ...demoHotelRuntime,
        customer,
        layout: demoHotelLayout as CustomerLayout,
        platform: {
          ...profile,
          capabilities: {
            ...profile.capabilities,
            ...detectRuntimeCapabilities(),
          },
        },
        services: {
          ...demoHotelIntegrations,
          runtime: {
            ...demoHotelIntegrations.runtime,
            customerId: customer,
          },
        } as ServiceGatewayConfig,
      };
    },
  };
}

function detectRuntimeCapabilities(): Record<string, boolean> {
  return {
    websocket: "WebSocket" in globalThis,
    pointerInput: "PointerEvent" in globalThis,
    localStorage: "localStorage" in globalThis,
  };
}
