import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { createXtvAliases } from "./tools/vite/xtv-aliases";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Same @x-tv/* aliases as the app build so tests import modules the real way.
  resolve: {
    alias: createXtvAliases(root),
  },
  test: {
    environment: "node",
    include: ["libs/**/*.test.ts"],
  },
});
