import { createLayoutRenderer } from "@x-tv/layout";
import { createNavigationEngine } from "@x-tv/navigation";
import { createRuntimeConfigLoader } from "@x-tv/runtime-config";
import { createServiceGateway } from "@x-tv/service-gateway";
import { createDefaultWidgetRegistry } from "@x-tv/widget-registry";

export type PlatformId = "samsung" | "lg" | "android";

export interface TvPlatformBootstrapOptions {
  appId: string;
  platformId: PlatformId;
  defaultProfile: string;
}

export interface TvPlatformRuntime {
  appId: string;
  start(): Promise<void>;
}

export async function bootstrapTvPlatform(
  options: TvPlatformBootstrapOptions,
): Promise<TvPlatformRuntime> {
  installBaseRuntimeStyles();

  const loader = createRuntimeConfigLoader({
    platformId: options.platformId,
    defaultProfile: options.defaultProfile,
  });
  const runtimeConfig = await loader.load();
  const services = createServiceGateway(runtimeConfig.services);
  const activeLayout = await services.layout.getActiveLayout(runtimeConfig.layout);
  const navigation = createNavigationEngine();
  const registry = createDefaultWidgetRegistry();
  const renderer = createLayoutRenderer({ registry, navigation });

  const runtime: TvPlatformRuntime = {
    appId: options.appId,
    async start() {
      await renderer.render(activeLayout, {
        customer: runtimeConfig.customer,
        locale: runtimeConfig.locale,
        platform: runtimeConfig.platform.platform,
        theme: runtimeConfig.theme,
        features: runtimeConfig.features,
      });
    },
  };

  await runtime.start();
  return runtime;
}

function installBaseRuntimeStyles(): void {
  if (document.querySelector("[data-xtv-runtime-styles]")) {
    return;
  }

  const styles = document.createElement("style");
  styles.dataset.xtvRuntimeStyles = "true";
  styles.textContent = `
    html,
    body,
    #app {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #07131f;
      color: #f5f8fb;
      font-family: Arial, Helvetica, sans-serif;
    }

    .xtv-layout-screen {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .xtv-hero-banner {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      background-color: #07131f;
      background-position: center;
      background-size: cover;
      outline: none;
    }

    .xtv-hero-banner:focus {
      box-shadow: inset 0 0 0 6px #49c6e5;
    }

    .xtv-hero-copy {
      max-width: 960px;
      padding-left: 96px;
    }

    .xtv-hero-copy h1 {
      margin: 0 0 24px;
      font-size: 72px;
      line-height: 1;
    }

    .xtv-hero-copy p {
      max-width: 720px;
      margin: 0 0 32px;
      font-size: 30px;
      line-height: 1.25;
    }

    .xtv-hero-copy small {
      color: #9db1c7;
      font-size: 22px;
      text-transform: uppercase;
    }
  `;

  document.head.appendChild(styles);
}
