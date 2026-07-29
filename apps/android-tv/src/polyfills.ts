// Runtime-method polyfills for old TV web engines. Tizen 6.5 = Chromium M76,
// which lacks Array/String `.at()` (M92) and String `.replaceAll()` (M85).
// Vendored @lightningjs (renderer/blits) code may call these, so they must be
// defined BEFORE any other import in main.ts. `build.target: chrome76` fixes the
// SYNTAX (??, ?., ??=); these cover the missing runtime METHODS.
export {}; // module scope (keeps the local `at` helper out of the global scope)

function at(this: { length: number; [i: number]: unknown }, index: number): unknown {
  const n = Math.trunc(index) || 0;
  const i = n < 0 ? this.length + n : n;
  return i < 0 || i >= this.length ? undefined : this[i];
}

if (typeof Array.prototype.at !== "function") {
  Object.defineProperty(Array.prototype, "at", { value: at, writable: true, configurable: true });
}

if (typeof String.prototype.at !== "function") {
  Object.defineProperty(String.prototype, "at", { value: at, writable: true, configurable: true });
}

if (typeof String.prototype.replaceAll !== "function") {
  Object.defineProperty(String.prototype, "replaceAll", {
    value: function replaceAll(this: string, find: string | RegExp, replace: string): string {
      if (find instanceof RegExp) {
        if (!find.global) {
          throw new TypeError("replaceAll must be called with a global RegExp");
        }
        return this.replace(find, replace);
      }
      return this.split(find).join(replace);
    },
    writable: true,
    configurable: true,
  });
}
