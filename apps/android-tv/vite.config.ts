import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import blits from "@lightningjs/blits/vite";
import { defineConfig } from "vite";
import { createXtvAliases } from "../../tools/vite/xtv-aliases";

const root = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(root, "../..");

export default defineConfig({
  root,
  // Relative base so bundle assets resolve under file:///android_asset/.
  base: "./",
  cacheDir: "../../node_modules/.vite/apps/android-tv",
  plugins: [...blits],
  resolve: {
    alias: createXtvAliases(workspaceRoot, process.env.VITE_XTV_CUSTOMER),
  },
  build: {
    // Older Android TV WebView builds lag Chrome; keep the same transpile floor.
    target: ["chrome76"],
    outDir: resolve(root, "../../dist/apps/android-tv"),
    emptyOutDir: true,
  },
  esbuild: { target: "chrome76" },
  server: {
    host: "127.0.0.1",
    port: 4303,
  },
});
