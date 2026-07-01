import type { AudioController } from "./audio-controller";

// The controller depends on this minimal shape, NOT on WebSocket. The websocket
// event bus satisfies it structurally, but so does a fake in a unit test — that
// is the whole point of keeping transport out of the policy.
export interface MuteEventSource {
  on(event: string, handler: (payload: unknown) => void): () => void;
}

// Head-end contract: { "type": "audio.mute", "payload": { "muted": true } }.
// One event with a boolean beats a mute/unmute pair — no ambiguity, idempotent.
export const MUTE_EVENT = "audio.mute";

interface MutePayload {
  muted: boolean;
}

function isMutePayload(payload: unknown): payload is MutePayload {
  return typeof payload === "object" && payload !== null && "muted" in payload;
}

export interface MutingController {
  start(source: MuteEventSource): void;
  stop(): void;
}

// Policy only: translate a mute event into an audio command. Knows nothing about
// how events arrive or how the TV mutes.
export function createMutingController(audio: AudioController): MutingController {
  let unsubscribe: (() => void) | undefined;

  return {
    start(source) {
      unsubscribe?.();
      unsubscribe = source.on(MUTE_EVENT, (payload) => {
        if (!isMutePayload(payload)) {
          console.warn("Ignoring malformed audio.mute event", payload);
          return;
        }
        audio.setMuted(payload.muted);
        console.info(`xTV audio ${payload.muted ? "muted" : "unmuted"} by head-end`);
      });
    },
    stop() {
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
}
