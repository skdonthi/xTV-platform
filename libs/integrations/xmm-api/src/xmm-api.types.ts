export interface XmmApiConfig {
  baseUrl: string;
  apiKey?: string;
  tenantId: string;
}

export interface XmmContentItemDto {
  id: string;
  title: string;
  imageUrl?: string;
  playbackUrl?: string;
}

export interface XmmLayoutDto {
  id: string;
  version: number;
  payload: unknown;
}
