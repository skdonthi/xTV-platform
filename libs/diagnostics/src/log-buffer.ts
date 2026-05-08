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

export function createLogBuffer(limit = 80): LogBuffer {
  const entries: LogEntry[] = [];
  const listeners = new Set<() => void>();

  return {
    entries() {
      return [...entries];
    },
    push(level, args) {
      entries.push({
        level,
        message: args.map(formatLogValue).join(" "),
        timestamp: new Date().toLocaleTimeString(),
      });

      while (entries.length > limit) {
        entries.shift();
      }

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
