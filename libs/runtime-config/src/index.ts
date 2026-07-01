import type { CustomerLayout } from "@x-tv/layout";
import type { KeymapConfig } from "@x-tv/navigation";
import type { ServiceGatewayConfig } from "@x-tv/service-gateway";
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
  keymapOverride: KeymapConfig;
}

export interface RuntimeConfigLoader {
  load(): Promise<RuntimeConfig>;
}

// Cruiseline axis: every tenant under customers/ is discovered at build time.
// Adding a new cruiseline = a new customers/<slug>/ folder, no loader edits.
const runtimeFiles = import.meta.glob("../../../customers/*/config/runtime.json", { eager: true });
const integrationFiles = import.meta.glob("../../../customers/*/config/integrations.json", {
  eager: true,
});
const keymapFiles = import.meta.glob("../../../customers/*/config/keymap.json", { eager: true });
const layoutFiles = import.meta.glob("../../../customers/*/layouts/home.json", { eager: true });

const runtimeByCustomer = indexByCustomer(runtimeFiles);
const integrationsByCustomer = indexByCustomer(integrationFiles);
const keymapByCustomer = indexByCustomer(keymapFiles);
const layoutByCustomer = indexByCustomer(layoutFiles);

// Provisioning aliases: head-end identifiers map to a tenant slug.
const customerAliases: Record<string, string> = {
  AIDA: "aida",
  CCL: "ccl",
  CARNIVAL: "ccl",
  DEMO_HOTEL: "demo-hotel",
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

      const runtime = runtimeByCustomer[customer];
      const integrations = integrationsByCustomer[customer];
      const layout = layoutByCustomer[customer];

      if (!runtime || !integrations || !layout) {
        throw new Error(
          `Cruiseline "${customer}" is missing config (runtime/integrations/layout). Did you scaffold customers/${customer}/?`,
        );
      }

      return {
        ...(runtime as Omit<
          RuntimeConfig,
          "customer" | "layout" | "platform" | "services" | "keymapOverride"
        >),
        customer,
        layout: layout as CustomerLayout,
        platform: {
          ...profile,
          capabilities: {
            ...profile.capabilities,
            ...detectRuntimeCapabilities(),
          },
        },
        services: {
          ...(integrations as ServiceGatewayConfig),
          runtime: {
            ...(integrations as ServiceGatewayConfig).runtime,
            customerId: customer,
          },
        } as ServiceGatewayConfig,
        keymapOverride: (keymapByCustomer[customer] as KeymapConfig | undefined) ?? { actions: {} },
      };
    },
  };
}

function indexByCustomer(files: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const [path, mod] of Object.entries(files)) {
    const parts = path.split("/");
    const idx = parts.lastIndexOf("customers");
    const slug = parts[idx + 1];
    if (!slug) {
      continue;
    }
    map[slug] = (mod as { default: unknown }).default;
  }
  return map;
}

function detectRuntimeCapabilities(): Record<string, boolean> {
  return {
    websocket: "WebSocket" in globalThis,
    pointerInput: "PointerEvent" in globalThis,
    localStorage: "localStorage" in globalThis,
  };
}
