import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { createXtvAliases } from "../../tools/vite/xtv-aliases";

const root = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(root, "../..");

export default defineConfig({
  root,
  // Relative base so bundle assets resolve under file:// (webOS package root).
  base: "./",
  cacheDir: "../../node_modules/.vite/apps/lg-tv",
  resolve: {
    alias: createXtvAliases(workspaceRoot, process.env.VITE_XTV_CUSTOMER),
  },
  build: {
    outDir: resolve(root, "../../dist/apps/lg-tv"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4302,
  },
});
