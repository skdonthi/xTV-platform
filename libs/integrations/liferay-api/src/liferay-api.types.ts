export interface LiferayApiConfig {
  baseUrl: string;
  siteId: string;
  accessToken?: string;
}

export interface LiferayContentDto {
  id: string;
  title: string;
  description?: string;
  image?: {
    url: string;
  };
}

export interface LiferayLayoutDto {
  id: string;
  name: string;
  contentFields: Array<{
    name: string;
    contentFieldValue: {
      data?: string;
    };
  }>;
}
