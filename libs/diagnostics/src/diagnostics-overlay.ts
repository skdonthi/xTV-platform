import type { DeviceInfo } from "./device-info";
import type { LogBuffer, LogEntry } from "./log-buffer";

export interface DiagnosticsOverlay {
  mount(): void;
  toggleConsole(): void;
}

export interface DiagnosticsOverlayConfig {
  pin: string;
  pinTimeoutMs: number;
  developerShortcuts: boolean;
}

export function createDiagnosticsOverlay(options: {
  deviceInfo: DeviceInfo;
  logBuffer: LogBuffer;
  config: DiagnosticsOverlayConfig;
}): DiagnosticsOverlay {
  const banner = createBanner(options.deviceInfo);
  const consolePanel = createConsolePanel(options.config);
  const renderLogs = () => renderLogEntries(consolePanel, options.logBuffer.entries());
  const pinBuffer = createPinBuffer(options.config);
  let mounted = false;

  options.logBuffer.subscribe(renderLogs);

  return {
    mount() {
      if (mounted) {
        return;
      }

      mounted = true;
      document.body.append(banner, consolePanel);
      renderLogs();
      window.addEventListener("keydown", (event) => {
        if (shouldToggleConsole(event, options.config, pinBuffer)) {
          event.preventDefault();
          this.toggleConsole();
        }
      });
    },
    toggleConsole() {
      consolePanel.dataset.visible = consolePanel.dataset.visible === "true" ? "false" : "true";
      renderLogs();
    },
  };
}

function createBanner(deviceInfo: DeviceInfo): HTMLElement {
  const banner = document.createElement("aside");
  banner.className = "xtv-debug-banner";
  banner.innerHTML = `
    <strong>${escapeHtml(deviceInfo.platform)} / ${escapeHtml(deviceInfo.profile)}</strong>
    <span>${escapeHtml(deviceInfo.customer)} | ${escapeHtml(deviceInfo.appId)}</span>
    <span>MAC ${escapeHtml(deviceInfo.macAddress)}</span>
    <span>${escapeHtml(deviceInfo.model)} | ${escapeHtml(deviceInfo.build)}</span>
  `;

  return banner;
}

function createConsolePanel(config: DiagnosticsOverlayConfig): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "xtv-debug-console";
  panel.dataset.visible = "false";
  panel.innerHTML = `
    <header>
      <strong>xTV diagnostics</strong>
      <span>PIN ${escapeHtml(config.pin)} | Dev: F2 / D / Info</span>
    </header>
    <pre></pre>
  `;

  return panel;
}

function renderLogEntries(panel: HTMLElement, entries: LogEntry[]): void {
  const output = panel.querySelector("pre");

  if (!output) {
    return;
  }

  output.textContent = entries
    .map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`)
    .join("\n");
  output.scrollTop = output.scrollHeight;
}

function shouldToggleConsole(
  event: KeyboardEvent,
  config: DiagnosticsOverlayConfig,
  pinBuffer: PinBuffer,
): boolean {
  const digit = readRemoteDigit(event);

  if (digit && pinBuffer.push(digit)) {
    return true;
  }

  if (!config.developerShortcuts) {
    return false;
  }

  return ["F2", "d", "D", "Info", "ColorF0Red"].includes(event.key);
}

interface PinBuffer {
  push(digit: string): boolean;
}

function createPinBuffer(config: DiagnosticsOverlayConfig): PinBuffer {
  let buffer = "";
  let lastInputAt = 0;

  return {
    push(digit) {
      const now = Date.now();

      if (now - lastInputAt > config.pinTimeoutMs) {
        buffer = "";
      }

      lastInputAt = now;
      buffer = `${buffer}${digit}`.slice(-config.pin.length);

      if (buffer !== config.pin) {
        return false;
      }

      buffer = "";
      return true;
    },
  };
}

function readRemoteDigit(event: KeyboardEvent): string | undefined {
  if (/^[0-9]$/.test(event.key)) {
    return event.key;
  }

  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.at(-1);
  }

  if (/^Numpad[0-9]$/.test(event.code)) {
    return event.code.at(-1);
  }

  const keyCodeDigit = keyCodeToDigit(event.keyCode);

  if (keyCodeDigit) {
    return keyCodeDigit;
  }

  return keyCodeToDigit(event.which);
}

function keyCodeToDigit(keyCode: number): string | undefined {
  if (keyCode >= 48 && keyCode <= 57) {
    return String(keyCode - 48);
  }

  if (keyCode >= 96 && keyCode <= 105) {
    return String(keyCode - 96);
  }

  return undefined;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
