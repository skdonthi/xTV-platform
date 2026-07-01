import { describe, expect, it } from "vitest";
import type { AudioController } from "./audio-controller";
import { MUTE_EVENT, type MuteEventSource, createMutingController } from "./muting-controller";

// A fake event source — proves the controller needs NO real websocket. This is
// the payoff of keeping transport out of policy: mute logic is testable in
// isolation, in pure Node, with zero network.
function fakeSource() {
  const handlers = new Map<string, (payload: unknown) => void>();
  const source: MuteEventSource = {
    on(event, handler) {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
  };
  return { source, emit: (event: string, payload: unknown) => handlers.get(event)?.(payload) };
}

function fakeAudio(): AudioController {
  let muted = false;
  return {
    setMuted: (next) => {
      muted = next;
    },
    isMuted: () => muted,
  };
}

describe("MutingController", () => {
  it("mutes and unmutes from head-end events", () => {
    const audio = fakeAudio();
    const { source, emit } = fakeSource();
    createMutingController(audio).start(source);

    emit(MUTE_EVENT, { muted: true });
    expect(audio.isMuted()).toBe(true);

    emit(MUTE_EVENT, { muted: false });
    expect(audio.isMuted()).toBe(false);
  });

  it("ignores malformed events (fail safe)", () => {
    const audio = fakeAudio();
    const { source, emit } = fakeSource();
    createMutingController(audio).start(source);

    emit(MUTE_EVENT, { nope: 1 });
    expect(audio.isMuted()).toBe(false);
  });

  it("stops listening after stop()", () => {
    const audio = fakeAudio();
    const { source, emit } = fakeSource();
    const controller = createMutingController(audio);
    controller.start(source);
    controller.stop();

    emit(MUTE_EVENT, { muted: true });
    expect(audio.isMuted()).toBe(false);
  });
});
