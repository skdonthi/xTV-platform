import type { RuntimeConfig } from "@x-tv/runtime-config";

// Bridges the resolved RuntimeConfig into Blits component state. Blits.Launch
// mounts the root Application which reads this in state(); we set it just before
// launch. (A Blits plugin is the richer option later; this keeps the seam small.)
let current: RuntimeConfig | undefined;

export function setBootConfig(config: RuntimeConfig): void {
  current = config;
}

export function getBootConfig(): RuntimeConfig {
  if (!current) {
    throw new Error("Boot config accessed before setBootConfig().");
  }
  return current;
}
