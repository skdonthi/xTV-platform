// A key can be matched by KeyboardEvent.key, KeyboardEvent.code, or a numeric
// keyCode (legacy TV remotes). Semantic actions decouple app logic from the
// physical remote, which differs per platform AND per cruiseline.
export type KeyId = string | number;

export interface KeymapConfig {
  actions: Record<string, KeyId[]>;
}

// Platform axis: each TV's REAL physical remote codes (verified against the
// legacy XMedia device services). Codes are matched against event.key,
// event.code AND event.keyCode, so both web names ("ArrowUp") and numeric TV
// codes (10009) resolve. Arrows 37-40, Enter 13 and colors 403-406 are shared;
// everything else diverges by platform. See docs/tv-platform-reference.md.
const NAV: Record<string, KeyId[]> = {
  up: ["ArrowUp", 38],
  down: ["ArrowDown", 40],
  left: ["ArrowLeft", 37],
  right: ["ArrowRight", 39],
  enter: ["Enter", 13],
};

const COLORS: Record<string, KeyId[]> = {
  red: [403],
  green: [404],
  yellow: [405],
  blue: [406],
};

const BASE_KEYMAPS: Record<string, KeymapConfig> = {
  // Samsung Tizen (registerKey codes; Return=10009, Exit=10182).
  samsung: {
    actions: {
      ...NAV,
      back: [10009, "Backspace"],
      exit: [10182],
      channelUp: [427],
      channelDown: [428],
      volumeUp: [447],
      volumeDown: [448],
      mute: [449],
      ...COLORS,
      play: [415],
      pause: [19],
      stop: [413],
      forward: [417],
      rewind: [412],
      playPause: [10252],
      info: [457],
    },
  },
  // LG webOS HCAP (Back=461, Exit=1001, Guide=458).
  lg: {
    actions: {
      ...NAV,
      back: [461, "Backspace"],
      exit: [1001],
      channelUp: [427],
      channelDown: [428],
      ...COLORS,
      play: [415],
      pause: [19],
      stop: [413],
      forward: [417],
      rewind: [412],
      info: [457],
      guide: [458],
    },
  },
  // Android TV WebView: standard DOM key events; BACK arrives via the native
  // bridge as "GoBack" (see MainActivity). No legacy reference — Android was not
  // in the legacy stack.
  android: {
    actions: {
      ...NAV,
      enter: ["Enter", 13, "NumpadEnter"],
      back: ["Backspace", "GoBack"],
      channelUp: [427],
      channelDown: [428],
      ...COLORS,
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
  // Swap the cruiseline keymap override live (used on hot config apply). Keep a
  // single engine instance for the app's lifetime and call this — do NOT create
  // a new engine per render, or the old key listener leaks.
  setKeymap(override?: KeymapConfig): void;
}

export function createNavigationEngine(options: NavigationEngineOptions = {}): NavigationEngine {
  const base = BASE_KEYMAPS[options.platform ?? ""] ?? { actions: {} };
  // Mutable so setKeymap() can hot-swap the remote mapping with no re-attach.
  let lookup = buildLookup(mergeKeymaps(base, options.keymapOverride));
  let controller: AbortController | undefined;

  return {
    attach(root) {
      // Idempotent: re-attaching cancels the previous listener instead of stacking.
      controller?.abort();
      controller = new AbortController();
      root.addEventListener(
        "keydown",
        (event) => {
          if (!(event instanceof KeyboardEvent)) {
            return;
          }

          // Reads the current `lookup` each keypress, so a live setKeymap() takes
          // effect immediately without re-subscribing.
          const action = resolveAction(event, lookup);
          if (!action) {
            return;
          }

          if (PREVENT_DEFAULT_ACTIONS.has(action)) {
            event.preventDefault();
          }

          // App code listens for "xtv:action" instead of raw key events, so a
          // new cruiseline remote is a config change, never a code change.
          root.dispatchEvent(new CustomEvent("xtv:action", { detail: { action }, bubbles: true }));
        },
        { signal: controller.signal },
      );
    },
    setKeymap(override) {
      lookup = buildLookup(mergeKeymaps(base, override));
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
