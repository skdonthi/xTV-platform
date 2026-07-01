import Blits from "@lightningjs/blits";
import {
  captureConsoleLogs,
  createDiagnosticsOverlay,
  createLogBuffer,
  readDeviceInfo,
} from "@x-tv/diagnostics";
import { createAudioController, createMutingController } from "@x-tv/muting";
import { createRuntimeConfigLoader } from "@x-tv/runtime-config";
import { createServiceGateway } from "@x-tv/service-gateway";
import { appStatePlugin } from "@x-tv/storage";
import { createWebsocketEventBus } from "@x-tv/websocket";
import App from "./app";
import { setBootConfig } from "./boot-config";

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

  // Resolve the active layout (local or head-end/remote) and hand the config to
  // the Blits app via the boot-config bridge.
  const services = createServiceGateway(runtimeConfig.services);
  runtimeConfig.layout = await services.layout.getActiveLayout(runtimeConfig.layout);
  setBootConfig(runtimeConfig);

  // Head-end can push {"type":"config.updated"} to re-pull config. With the Blits
  // canvas we soft-reload to re-launch (Blits-reactive in-place hot-apply — update
  // app state instead of reload — is the next step).
  function connectLiveConfig(): void {
    const wsUrl = runtimeConfig.realtime.websocketUrl;
    if (!runtimeConfig.features.websocketEvents || !wsUrl) {
      return;
    }
    const bus = createWebsocketEventBus();
    bus.connect(wsUrl);
    bus.on("config.updated", () => {
      console.info("xTV config.updated — reloading");
      globalThis.location?.reload();
    });
  }

  // Muting is a cruiseline feature (flag + head-end socket) whose mechanism is
  // platform-specific (the audio adapter). The composition root is the only place
  // that knows both — the controller and adapter never reference each other's world.
  function connectMuting(): void {
    const url = runtimeConfig.realtime.mutingUrl;
    if (!runtimeConfig.features.audioMuting || !url) {
      return;
    }
    const audio = createAudioController(runtimeConfig.platform.platform);
    const controller = createMutingController(audio);
    const bus = createWebsocketEventBus();
    bus.connect(url);
    controller.start(bus);
    console.info("xTV muting service connected", { url });
  }

  const runtime: TvPlatformRuntime = {
    appId: options.appId,
    async start() {
      // Global reactive app state (Blits appState plugin), seeded from config.
      // Components read/write via this.$appState.
      Blits.Plugin(appStatePlugin, {
        customer: runtimeConfig.customer,
        platform: runtimeConfig.platform.platform,
        locale: runtimeConfig.locale,
      });

      // Launch the Blits (LightningJS canvas) app into #app. The font set is
      // tenant-driven (customers/<line>/config.json `fonts`), served from the
      // tenant public dir with relative paths so they resolve under file://.
      Blits.Launch(App, "app", {
        w: 1920,
        h: 1080,
        debugLevel: 1,
        defaultFont: runtimeConfig.fonts.default,
        fonts: runtimeConfig.fonts.families,
      } as Parameters<typeof Blits.Launch>[2]);
      if (runtimeConfig.diagnostics.enabled) {
        diagnostics.mount();
      }
      connectLiveConfig();
      connectMuting();
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
