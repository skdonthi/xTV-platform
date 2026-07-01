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

injectTizenSdk();

void bootstrapTvPlatform({
  appId: "samsung-tv",
  platformId: "samsung",
  defaultProfile: "tizen6",
});
