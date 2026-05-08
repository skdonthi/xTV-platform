import i18next, { type i18n, type Resource } from "i18next";

export async function createI18n(locale: string, resources: Resource): Promise<i18n> {
  const instance = i18next.createInstance();

  await instance.init({
    lng: locale,
    fallbackLng: "en",
    resources,
  });

  return instance;
}
