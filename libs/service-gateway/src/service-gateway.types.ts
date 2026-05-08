import type { CustomerLayout } from "@x-tv/layout";

export type BackendSource = "local" | "xmm" | "liferay";

export interface GatewayRuntimeConfig {
  customerId: string;
  layoutSource: BackendSource;
  contentSource: BackendSource;
}

export interface ContentItem {
  id: string;
  title: string;
  imageUrl?: string;
  playbackUrl?: string;
}

export interface ContentGateway {
  getHomeContent(): Promise<ContentItem[]>;
}

export interface LayoutGateway {
  getActiveLayout(fallbackLayout: CustomerLayout): Promise<CustomerLayout>;
}

export interface RemoteControlGateway {
  createPairingSession(): Promise<{
    sessionId: string;
    pairingCode: string;
    expiresAt: string;
  }>;
}
