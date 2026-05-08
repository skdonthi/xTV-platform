export type FeatureFlags = Record<string, boolean>;

export function isFeatureEnabled(flags: FeatureFlags, key: string): boolean {
  return flags[key] === true;
}
