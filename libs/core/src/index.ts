import {
  captureConsoleLogs,
  createDiagnosticsOverlay,
  createLogBuffer,
  readDeviceInfo,
} from "@x-tv/diagnostics";
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
  const logBuffer = createLogBuffer();
  captureConsoleLogs(logBuffer);

  const loader = createRuntimeConfigLoader({
    platformId: options.platformId,
    defaultProfile: options.defaultProfile,
  });
  const runtimeConfig = await loader.load();
  const deviceInfo = readDeviceInfo({
    appId: options.appId,
    customer: runtimeConfig.customer,
    platform: runtimeConfig.platform.platform,
    profile: runtimeConfig.platform.id,
  });
  const diagnostics = createDiagnosticsOverlay({
    deviceInfo,
    logBuffer,
    config: runtimeConfig.diagnostics,
  });
  const services = createServiceGateway(runtimeConfig.services);
  const activeLayout = await services.layout.getActiveLayout(runtimeConfig.layout);
  const navigation = createNavigationEngine({
    platform: runtimeConfig.platform.platform,
    keymapOverride: runtimeConfig.keymapOverride,
  });
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
      if (runtimeConfig.diagnostics.enabled) {
        diagnostics.mount();
      }
      console.info("xTV runtime started", {
        appId: options.appId,
        customer: runtimeConfig.customer,
        platform: runtimeConfig.platform.id,
        deviceId: deviceInfo.deviceId,
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

    .xtv-debug-banner {
      position: fixed;
      top: 20px;
      right: 24px;
      z-index: 20;
      display: grid;
      gap: 4px;
      min-width: 360px;
      padding: 12px 16px;
      border: 1px solid rgb(73 198 229 / 50%);
      background: rgb(3 12 22 / 82%);
      color: #f5f8fb;
      font-size: 18px;
      line-height: 1.2;
      text-align: right;
      box-shadow: 0 8px 24px rgb(0 0 0 / 30%);
    }

    .xtv-debug-banner strong {
      color: #49c6e5;
      font-size: 20px;
      text-transform: uppercase;
    }

    .xtv-debug-banner span {
      color: #d8e5ef;
      white-space: nowrap;
    }

    .xtv-debug-console {
      position: fixed;
      right: 24px;
      bottom: 24px;
      left: 24px;
      z-index: 30;
      display: none;
      height: 42vh;
      border: 1px solid rgb(73 198 229 / 65%);
      background: rgb(2 8 14 / 92%);
      color: #f5f8fb;
      box-shadow: 0 12px 36px rgb(0 0 0 / 45%);
    }

    .xtv-debug-console[data-visible="true"] {
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .xtv-debug-console header {
      display: flex;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid rgb(255 255 255 / 14%);
      color: #49c6e5;
      font-size: 20px;
    }

    .xtv-debug-console pre {
      margin: 0;
      overflow: auto;
      padding: 16px 18px;
      color: #d8e5ef;
      font-family: monospace;
      font-size: 18px;
      line-height: 1.35;
      white-space: pre-wrap;
    }
  `;

  document.head.appendChild(styles);
}
