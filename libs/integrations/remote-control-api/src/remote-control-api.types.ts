export interface RemoteControlApiConfig {
  baseUrl: string;
  deviceId: string;
  pairingToken?: string;
}

export interface RemoteControlSessionDto {
  sessionId: string;
  pairingCode: string;
  expiresAt: string;
}

export interface RemoteControlCommandDto {
  command: "up" | "down" | "left" | "right" | "select" | "back" | "play" | "pause";
  issuedAt: string;
}
