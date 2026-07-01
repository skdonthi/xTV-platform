import { resolve } from "node:path";

// Per-brand isolation: `@x-tv/tenant/*` resolves to exactly ONE cruiseline's
// files at build time (keyed by the resolved customer slug). Nothing globs all
// tenants, so a brand's bundle can never contain another brand's config/layout.
export function createXtvAliases(
  workspaceRoot: string,
  customer = "demo-hotel",
): Record<string, string> {
  return {
    "@x-tv/tenant/config": resolve(workspaceRoot, `customers/${customer}/config.json`),
    "@x-tv/tenant/layout": resolve(workspaceRoot, `customers/${customer}/layouts/home.json`),
    "@x-tv/core": resolve(workspaceRoot, "libs/core/src/index.ts"),
    "@x-tv/diagnostics": resolve(workspaceRoot, "libs/diagnostics/src/index.ts"),
    "@x-tv/layout": resolve(workspaceRoot, "libs/layout/src/index.ts"),
    "@x-tv/widget-registry": resolve(workspaceRoot, "libs/widget-registry/src/index.ts"),
    "@x-tv/navigation": resolve(workspaceRoot, "libs/navigation/src/index.ts"),
    "@x-tv/websocket": resolve(workspaceRoot, "libs/websocket/src/index.ts"),
    "@x-tv/player": resolve(workspaceRoot, "libs/player/src/index.ts"),
    "@x-tv/i18n": resolve(workspaceRoot, "libs/i18n/src/index.ts"),
    "@x-tv/integrations/liferay-api": resolve(
      workspaceRoot,
      "libs/integrations/liferay-api/src/index.ts",
    ),
    "@x-tv/integrations/remote-control-api": resolve(
      workspaceRoot,
      "libs/integrations/remote-control-api/src/index.ts",
    ),
    "@x-tv/integrations/xmm-api": resolve(workspaceRoot, "libs/integrations/xmm-api/src/index.ts"),
    "@x-tv/widgets": resolve(workspaceRoot, "libs/widgets/src/index.ts"),
    "@x-tv/service-gateway": resolve(workspaceRoot, "libs/service-gateway/src/index.ts"),
    "@x-tv/runtime-config": resolve(workspaceRoot, "libs/runtime-config/src/index.ts"),
    "@x-tv/feature-flags": resolve(workspaceRoot, "libs/feature-flags/src/index.ts"),
    "@x-tv/themes": resolve(workspaceRoot, "libs/themes/src/index.ts"),
  };
}
