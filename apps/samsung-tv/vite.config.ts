import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { createXtvAliases } from "../../tools/vite/xtv-aliases";

const root = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(root, "../..");

export default defineConfig({
  root,
  // Relative base so bundle assets resolve under file:// (Tizen widget root).
  // This is the LightningJS analog of CCL's XC_WEB_ROOT path-portability fix.
  base: "./",
  cacheDir: "../../node_modules/.vite/apps/samsung-tv",
  resolve: {
    alias: createXtvAliases(workspaceRoot, process.env.VITE_XTV_CUSTOMER),
  },
  build: {
    outDir: resolve(root, "../../dist/apps/samsung-tv"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4301,
  },
});
