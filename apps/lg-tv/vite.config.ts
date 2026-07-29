import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import blits from "@lightningjs/blits/vite";
import { defineConfig } from "vite";
import { createXtvAliases } from "../../tools/vite/xtv-aliases";

const root = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(root, "../..");

export default defineConfig({
  root,
  // Relative base so bundle assets resolve under file:// (webOS package root).
  base: "./",
  cacheDir: "../../node_modules/.vite/apps/lg-tv",
  plugins: [...blits],
  resolve: {
    alias: createXtvAliases(workspaceRoot, process.env.VITE_XTV_CUSTOMER),
  },
  build: {
    // webOS on older panels also runs an old Chromium; transpile to a safe floor.
    target: ["chrome76"],
    outDir: resolve(root, "../../dist/apps/lg-tv"),
    emptyOutDir: true,
  },
  esbuild: { target: "chrome76" },
  server: {
    host: "127.0.0.1",
    port: 4302,
  },
});
