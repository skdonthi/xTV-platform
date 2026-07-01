// A key can be matched by KeyboardEvent.key, KeyboardEvent.code, or a numeric
// keyCode (legacy TV remotes). Semantic actions decouple app logic from the
// physical remote, which differs per platform AND per cruiseline.
export type KeyId = string | number;

export interface KeymapConfig {
  actions: Record<string, KeyId[]>;
}

// Platform axis: base keycodes for the standard D-pad + back on each container.
const BASE_KEYMAPS: Record<string, KeymapConfig> = {
  samsung: {
    actions: {
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      enter: ["Enter"],
      back: ["XF86Back", 10009],
    },
  },
  lg: {
    actions: {
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      enter: ["Enter"],
      back: ["Back", 461],
    },
  },
  android: {
    actions: {
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      enter: ["Enter", "NumpadEnter"],
      back: ["Backspace", "GoBack"],
    },
  },
};

const PREVENT_DEFAULT_ACTIONS = new Set(["up", "down", "left", "right", "enter", "back"]);

export interface NavigationEngineOptions {
  platform?: string;
  keymapOverride?: KeymapConfig;
}

export interface NavigationEngine {
  attach(root: Element): void;
}

export function createNavigationEngine(options: NavigationEngineOptions = {}): NavigationEngine {
  const base = BASE_KEYMAPS[options.platform ?? ""] ?? { actions: {} };
  const keymap = mergeKeymaps(base, options.keymapOverride);
  const lookup = buildLookup(keymap);

  return {
    attach(root) {
      root.addEventListener("keydown", (event) => {
        if (!(event instanceof KeyboardEvent)) {
          return;
        }

        const action = resolveAction(event, lookup);
        if (!action) {
          return;
        }

        if (PREVENT_DEFAULT_ACTIONS.has(action)) {
          event.preventDefault();
        }

        // App code listens for "xtv:action" instead of raw key events, so a new
        // cruiseline remote is a config change, never a code change.
        root.dispatchEvent(new CustomEvent("xtv:action", { detail: { action }, bubbles: true }));
      });
    },
  };
}

// Cruiseline override is additive: it adds physical keys to a platform action.
export function mergeKeymaps(base: KeymapConfig, override?: KeymapConfig): KeymapConfig {
  const actions: Record<string, KeyId[]> = {};
  for (const [action, keys] of Object.entries(base.actions)) {
    actions[action] = [...keys];
  }
  for (const [action, keys] of Object.entries(override?.actions ?? {})) {
    actions[action] = [...new Set([...(actions[action] ?? []), ...keys])];
  }
  return { actions };
}

function buildLookup(keymap: KeymapConfig): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [action, keys] of Object.entries(keymap.actions)) {
    for (const key of keys) {
      lookup.set(String(key), action);
    }
  }
  return lookup;
}

function resolveAction(event: KeyboardEvent, lookup: Map<string, string>): string | undefined {
  return lookup.get(event.key) ?? lookup.get(event.code) ?? lookup.get(String(event.keyCode));
}
