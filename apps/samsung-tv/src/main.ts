import { bootstrapTvPlatform } from "@x-tv/core";

// Inject the Tizen firmware SDK globals at runtime. Static <script> tags in
// index.html can't be bundled by Vite ($WEBAPIS/$B2BAPIS are TV-resolved tokens,
// not real files). On a real TV these resolve and create webapis.avplay /
// tizen.tvaudiocontrol; in a browser they 404 and the guarded adapters fall back.
function injectTizenSdk(): void {
  const sources = [
    "$WEBAPIS/webapis/webapis.js",
    "$WEBAPIS/avplayextension/avplayextension.js",
    "$B2BAPIS/b2bapis/b2bapis.js",
  ];
  for (const src of sources) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }
}

// Tizen only delivers remote keys the app has registered. Blits registers the
// D-pad/back; number keys (diagnostics PIN) + colour keys are NOT delivered
// unless registered here. SDK scripts load async, so retry until tizen appears.
function registerRemoteKeys(): void {
  const KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "ColorF0Red", "Info"];
  let tries = 0;
  const id = setInterval(() => {
    const input = (
      (globalThis as Record<string, unknown>).tizen as
        | { tvinputdevice?: { registerKey(name: string): void } }
        | undefined
    )?.tvinputdevice;
    if (input) {
      for (const k of KEYS) {
        try {
          input.registerKey(k);
        } catch {
          // key not supported on this model — ignore
        }
      }
      clearInterval(id);
    } else if (++tries > 20) {
      clearInterval(id); // ~10s: not a Tizen device (browser/dev)
    }
  }, 500);
}

injectTizenSdk();
registerRemoteKeys();

void bootstrapTvPlatform({
  appId: "samsung-tv",
  platformId: "samsung",
  defaultProfile: "tizen6",
});
