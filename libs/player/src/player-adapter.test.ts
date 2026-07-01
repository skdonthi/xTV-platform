import { describe, expect, it } from "vitest";
import { createPlayerAdapter } from "./player-adapter";

// Runs in node (no DOM, no TV globals) — proves every adapter degrades safely
// off-device: the factory always returns a usable adapter and the full lifecycle
// never throws. On a real TV the same calls drive avplay / ExoPlayer / <video>.
describe("createPlayerAdapter", () => {
  for (const platform of ["samsung", "lg", "android", "browser"]) {
    it(`gives a safe adapter for ${platform}`, async () => {
      const player = createPlayerAdapter(platform);

      await player.load("https://headend/live/stream.m3u8");
      await player.play();
      expect(player.getStatus()).toBe("playing");

      await player.pause();
      expect(player.getStatus()).toBe("paused");

      await player.stop();
      player.destroy();
      expect(player.getStatus()).toBe("idle");
    });
  }
});
