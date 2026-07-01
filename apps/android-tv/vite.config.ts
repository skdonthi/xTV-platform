import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { createXtvAliases } from "../../tools/vite/xtv-aliases";

const root = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(root, "../..");

export default defineConfig({
  root,
  // Relative base so bundle assets resolve under file:///android_asset/.
  base: "./",
  cacheDir: "../../node_modules/.vite/apps/android-tv",
  resolve: {
    alias: createXtvAliases(workspaceRoot, process.env.VITE_XTV_CUSTOMER),
  },
  build: {
    outDir: resolve(root, "../../dist/apps/android-tv"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4303,
  },
});
