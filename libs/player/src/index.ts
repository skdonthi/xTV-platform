export interface PlayerAdapter {
  load(sourceUrl: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
}

export function createNoopPlayerAdapter(): PlayerAdapter {
  return {
    async load() {},
    async play() {},
    async pause() {},
  };
}
