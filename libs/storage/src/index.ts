import appStatePlugin from "@lightningjs/blits/plugins/appstate";
import storagePlugin from "@lightningjs/blits/plugins/storage";

// Reusable persistence built on Blits' storage plugin (localStorage under the
// hood), but usable ANYWHERE — including at bootstrap before Blits.Launch and
// inside components — because the plugin's factory returns a plain API object.
export interface Storage {
  get<T = unknown>(key: string): T | null;
  set(key: string, value: unknown): boolean;
  remove(key: string): void;
}

type Backing = {
  get<T = unknown>(key: string): T | null;
  set(key: string, value: unknown): boolean;
  remove(key: string): void;
  clear(): void;
};

// localStorage-backed when available, else an in-memory Map — so calls never
// throw on a TV with no/limited storage (file://, quota, private mode).
function createBacking(): Backing {
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      return storagePlugin.plugin();
    }
  } catch {
    // fall through to in-memory
  }
  const mem = new Map<string, string>();
  return {
    get: <T>(key: string) => (mem.has(key) ? (JSON.parse(mem.get(key) as string) as T) : null),
    set: (key: string, value: unknown) => {
      mem.set(key, JSON.stringify(value));
      return true;
    },
    remove: (key: string) => {
      mem.delete(key);
    },
    clear: () => mem.clear(),
  };
}

const backing = createBacking();

// Namespaced storage. Keys are prefixed `xtv.<namespace>.` so features never
// collide. Import and reuse anywhere: `const s = createStorage("device")`.
export function createStorage(namespace: string): Storage {
  const prefix = `xtv.${namespace}.`;
  return {
    get<T = unknown>(key: string): T | null {
      try {
        return backing.get<T>(prefix + key);
      } catch {
        return null;
      }
    },
    set(key: string, value: unknown): boolean {
      try {
        return backing.set(prefix + key, value);
      } catch {
        return false;
      }
    },
    remove(key: string): void {
      try {
        backing.remove(prefix + key);
      } catch {
        // ignore
      }
    },
  };
}

// Blits-shipped plugins re-exported for the composition root to register.
// - appState: global reactive app state (accessed in components as this.$appState)
// - storage:  the persistence backing (also used internally by createStorage)
export { appStatePlugin, storagePlugin };
