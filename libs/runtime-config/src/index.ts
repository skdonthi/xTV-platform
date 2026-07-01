import type { CustomerLayout } from "@x-tv/layout";
import type { KeymapConfig } from "@x-tv/navigation";
import type { ServiceGatewayConfig } from "@x-tv/service-gateway";
// `@x-tv/tenant/*` is aliased at build time to exactly ONE cruiseline's files
// (see tools/vite/xtv-aliases.ts). Static imports mean the bundle contains only
// the active brand — no other tenant's config/layout/names ever ship (GDPR).
import tenantConfig from "@x-tv/tenant/config";
import tenantLayout from "@x-tv/tenant/layout";
import androidTv12 from "../../../platforms/android/profiles/android-tv-12.json";
import webos3 from "../../../platforms/lg/profiles/webos3.json";
import webos5 from "../../../platforms/lg/profiles/webos5.json";
import webos6 from "../../../platforms/lg/profiles/webos6.json";
import tizen6 from "../../../platforms/samsung/profiles/tizen6.json";
import tizen7 from "../../../platforms/samsung/profiles/tizen7.json";
import tizen9 from "../../../platforms/samsung/profiles/tizen9.json";
import tizen10 from "../../../platforms/samsung/profiles/tizen10.json";

export interface PlatformProfile {
  id: string;
  platform: string;
  capabilities: Record<string, boolean | string | number>;
}

// Tenant-declared font set (Blits font descriptors). `file` is relative to the
// tenant public dir so it resolves under file:// on-device.
export interface FontFace {
  family: string;
  type: "msdf" | "sdf" | "web";
  file: string;
}

export interface FontSet {
  default: string;
  families: FontFace[];
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
  realtime: { websocketUrl?: string; mutingUrl?: string };
  fonts: FontSet;
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

interface TenantRuntimeSection {
  customer: string;
  locale: string;
  theme: string; // theme id (device/group-driven theming comes later via XMM)
  features: Record<string, boolean>;
  diagnostics: RuntimeConfig["diagnostics"];
}

interface TenantConfigFile {
  runtime: TenantRuntimeSection;
  integrations: TenantIntegrations;
  identity?: unknown;
  keymap?: KeymapConfig;
  fonts?: FontSet;
}

const bundledConfig = tenantConfig as unknown as TenantConfigFile;
const bundledLayout = tenantLayout as unknown as CustomerLayout;

const platformProfiles: Record<string, PlatformProfile> = {
  tizen6,
  tizen7,
  tizen9,
  tizen10,
  webos3,
  webos5,
  webos6,
  "android-tv-12": androidTv12,
};

export function createRuntimeConfigLoader(options: {
  platformId: string;
  defaultProfile: string;
}): RuntimeConfigLoader {
  return {
    async load() {
      const requestedProfile = import.meta.env.VITE_XTV_PROFILE ?? options.defaultProfile;
      const profile = platformProfiles[requestedProfile];

      if (!profile) {
        throw new Error(`Platform profile "${requestedProfile}" is not configured.`);
      }

      if (profile.platform !== options.platformId) {
        throw new Error(
          `Profile "${requestedProfile}" belongs to "${profile.platform}", not "${options.platformId}".`,
        );
      }

      const customer = bundledConfig.runtime.customer;

      // Bundled config is the fallback default; the head-end override (if any)
      // is authoritative and merged on top — so config changes without a rebuild.
      const merged = await applyRemoteOverride(bundledConfig);
      const integrations = merged.integrations;
      const runtime = merged.runtime;

      return {
        customer,
        locale: runtime.locale,
        theme: runtime.theme,
        features: runtime.features,
        diagnostics: runtime.diagnostics,
        layout: bundledLayout,
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
        realtime: {
          websocketUrl: integrations.websocket?.url,
          mutingUrl: integrations.mutingService?.url,
        },
        // Built-in "sans-serif" renderer default when a tenant declares no fonts.
        fonts: merged.fonts ?? { default: "sans-serif", families: [] },
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

function detectRuntimeCapabilities(): Record<string, boolean> {
  return {
    websocket: "WebSocket" in globalThis,
    pointerInput: "PointerEvent" in globalThis,
    localStorage: "localStorage" in globalThis,
  };
}
