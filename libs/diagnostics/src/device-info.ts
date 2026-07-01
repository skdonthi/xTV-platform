import { createStorage } from "@x-tv/storage";

const deviceStore = createStorage("device");

export interface DeviceInfo {
  platform: string;
  profile: string;
  appId: string;
  customer: string;
  macAddress: string;
  deviceId: string;
  model: string;
  firmware: string;
  build: string;
  userAgent: string;
  resolution: string;
}

export interface DeviceInfoInput {
  appId: string;
  customer: string;
  platform: string;
  profile: string;
}

export function readDeviceInfo(input: DeviceInfoInput): DeviceInfo {
  const tizenSystemInfo = readTizenSystemInfo();
  const webosDeviceInfo = readWebosDeviceInfo();
  const androidDeviceInfo = readAndroidDeviceInfo();

  return {
    platform: input.platform,
    profile: input.profile,
    appId: input.appId,
    customer: input.customer,
    macAddress:
      tizenSystemInfo.macAddress ??
      webosDeviceInfo.macAddress ??
      androidDeviceInfo.macAddress ??
      "unavailable",
    deviceId:
      tizenSystemInfo.deviceId ??
      webosDeviceInfo.deviceId ??
      androidDeviceInfo.deviceId ??
      fallbackDeviceId(),
    model:
      tizenSystemInfo.model ??
      webosDeviceInfo.model ??
      androidDeviceInfo.model ??
      navigator.platform ??
      "unknown",
    firmware: tizenSystemInfo.firmware ?? webosDeviceInfo.firmware ?? "unknown",
    build: androidDeviceInfo.build ?? readBrowserBuild(),
    userAgent: navigator.userAgent,
    resolution: `${window.screen.width}x${window.screen.height}`,
  };
}

function readTizenSystemInfo(): Partial<DeviceInfo> {
  const webapis = readGlobalRecord("webapis");
  const productInfo = readRecord(webapis?.productinfo);
  const network = readRecord(webapis?.network);

  return {
    macAddress: callString(network, "getMac"),
    deviceId: callString(productInfo, "getDuid"),
    model: callString(productInfo, "getModel"),
    firmware: callString(productInfo, "getFirmware"),
  };
}

function readWebosDeviceInfo(): Partial<DeviceInfo> {
  const palmSystem = readRecord(readGlobalRecord("PalmSystem"));
  const identifier = readString(palmSystem?.identifier);
  const deviceInfo = parseJsonRecord(readString(palmSystem?.deviceInfo));

  return {
    deviceId: identifier,
    model: readString(deviceInfo?.modelName) ?? readString(deviceInfo?.modelNameAscii),
    firmware: readString(deviceInfo?.firmwareVersion),
  };
}

function readAndroidDeviceInfo(): Partial<DeviceInfo> {
  const androidXtv = readGlobalRecord("xtvAndroid");

  return {
    macAddress: callString(androidXtv, "getMacAddress"),
    deviceId: callString(androidXtv, "getDeviceId"),
    model: callString(androidXtv, "getModel"),
    build: callString(androidXtv, "getBuildVersion"),
  };
}

function fallbackDeviceId(): string {
  const existing = deviceStore.get<string>("id");
  if (existing) {
    return existing;
  }

  const generated = globalThis.crypto?.randomUUID?.() ?? `preview-${Date.now()}`;
  deviceStore.set("id", generated);
  return generated;
}

function readBrowserBuild(): string {
  return import.meta.env.MODE;
}

function readGlobalRecord(key: string): Record<string, unknown> | undefined {
  return readRecord(globalThis[key as keyof typeof globalThis]);
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseJsonRecord(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return readRecord(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function callString(
  source: Record<string, unknown> | undefined,
  method: string,
): string | undefined {
  const fn = source?.[method];

  if (typeof fn !== "function") {
    return undefined;
  }

  try {
    return readString(fn.call(source));
  } catch {
    return undefined;
  }
}
