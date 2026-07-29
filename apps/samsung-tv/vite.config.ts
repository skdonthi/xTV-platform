import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import blits from "@lightningjs/blits/vite";
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
  plugins: [...blits],
  resolve: {
    alias: createXtvAliases(workspaceRoot, process.env.VITE_XTV_CUSTOMER),
  },
  build: {
    // Tizen 6.5 = Chromium M76: no ?? / ?. / ??= syntax. Transpile down or the
    // whole bundle parse-errors → blank screen. chrome76 floor covers 7 & 9 too.
    target: ["chrome76"],
    outDir: resolve(root, "../../dist/apps/samsung-tv"),
    emptyOutDir: true,
  },
  // Belt-and-suspenders: make esbuild's dep transpile use the same floor even if
  // a plugin tries to force esnext.
  esbuild: { target: "chrome76" },
  server: {
    host: "127.0.0.1",
    port: 4301,
  },
});
