// MUST be first — installs runtime-method polyfills before any vendored code loads.
import "./polyfills";
import { bootstrapTvPlatform } from "@x-tv/core";

void bootstrapTvPlatform({
  appId: "lg-tv",
  platformId: "lg",
  defaultProfile: "webos6",
});
