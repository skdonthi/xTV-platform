import { createStorage } from "@x-tv/storage";

export type LogLevel = "log" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
}

export interface LogBuffer {
  entries(): LogEntry[];
  push(level: LogLevel, args: unknown[]): void;
  subscribe(listener: () => void): () => void;
}

// Persisted so logs survive a reload — config.updated logs then reloads, so the
// line would otherwise be gone before diagnostics is even opened. Best-effort
// (storage no-ops if unavailable); kept small.
const store = createStorage("diag");
const STORE_KEY = "log";

// Date + time, stable/sortable (YYYY-MM-DD HH:MM:SS) — TVs asked for the date too.
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function createLogBuffer(limit = 80): LogBuffer {
  const entries: LogEntry[] = (store.get<LogEntry[]>(STORE_KEY) ?? []).slice(-limit);
  const listeners = new Set<() => void>();

  return {
    entries() {
      return [...entries];
    },
    push(level, args) {
      entries.push({
        level,
        message: args.map(formatLogValue).join(" "),
        timestamp: stamp(),
      });

      while (entries.length > limit) {
        entries.shift();
      }

      // Sync save so the last line (e.g. config.updated) is persisted BEFORE the
      // reload that immediately follows it.
      store.set(STORE_KEY, entries);

      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function captureConsoleLogs(buffer: LogBuffer): void {
  const levels: LogLevel[] = ["log", "info", "warn", "error"];

  for (const level of levels) {
    const original = console[level].bind(console);

    console[level] = (...args: unknown[]) => {
      buffer.push(level, args);
      original(...args);
    };
  }
}

function formatLogValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
