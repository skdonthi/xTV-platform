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
  realtime: { websocketUrl?: string };
}

export interface RuntimeConfigLoader {
  load(): Promise<RuntimeConfig>;
}

// The single sectioned tenant document (customers/<line>/config.json).
interface TenantIntegrations extends ServiceGatewayConfig {
  websocket?: { url: string } | null;
  mutingService?: { url: string; channel?: string } | null;
  // Head-end URL for the authoritative config override fetched at boot.
  configUrl?: string | null;
}

interface TenantConfigFile {
  runtime: Omit<RuntimeConfig, "layout" | "platform" | "services" | "keymapOverride" | "realtime">;
  integrations: TenantIntegrations;
  identity?: unknown;
  keymap?: KeymapConfig;
}

// Cruiseline axis: every tenant under customers/ is discovered at build time.
// Adding a new cruiseline = a new customers/<slug>/config.json, no loader edits.
const configFiles = import.meta.glob("../../../customers/*/config.json", { eager: true });
const layoutFiles = import.meta.glob("../../../customers/*/layouts/home.json", { eager: true });

const configByCustomer = indexByCustomer(configFiles);
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

      const bundled = configByCustomer[customer] as TenantConfigFile | undefined;
      const layout = layoutByCustomer[customer];

      if (!bundled || !layout) {
        throw new Error(
          `Cruiseline "${customer}" is missing config (config.json/layout). Did you scaffold customers/${customer}/?`,
        );
      }

      // Bundled config is the fallback default; the head-end override (if any)
      // is authoritative and merged on top — so config changes without a rebuild.
      const merged = await applyRemoteOverride(bundled);
      const integrations = merged.integrations;

      return {
        ...merged.runtime,
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
            ...integrations.runtime,
            customerId: customer,
          },
        } as ServiceGatewayConfig,
        keymapOverride: merged.keymap ?? { actions: {} },
        realtime: { websocketUrl: integrations.websocket?.url },
      };
    },
  };
}

async function applyRemoteOverride(bundled: TenantConfigFile): Promise<TenantConfigFile> {
  const url = bundled.integrations?.configUrl;
  if (!url || typeof fetch === "undefined") {
    return bundled;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const remote = (await response.json()) as Partial<TenantConfigFile>;
    return deepMerge(bundled, remote) as TenantConfigFile;
  } catch (error) {
    console.warn(`Remote config fetch failed (${url}); using bundled defaults.`, error);
    return bundled;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Recursive merge: override scalars/arrays replace, nested objects merge.
function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override ?? base;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return result;
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
