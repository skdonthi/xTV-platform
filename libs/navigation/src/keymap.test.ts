import { describe, expect, it } from "vitest";
import { mergeKeymaps } from "./index";

describe("mergeKeymaps", () => {
  it("adds cruiseline override keys on top of the platform base", () => {
    const merged = mergeKeymaps(
      { actions: { back: ["XF86Back"] } },
      { actions: { back: [10009], watchTv: ["ChannelUp"] } },
    );

    // base key kept, tenant key added to the same action
    expect(merged.actions.back).toContain("XF86Back");
    expect(merged.actions.back).toContain(10009);
    // tenant-only action introduced
    expect(merged.actions.watchTv).toEqual(["ChannelUp"]);
  });

  it("dedupes keys shared between base and override", () => {
    const merged = mergeKeymaps(
      { actions: { enter: ["Enter"] } },
      { actions: { enter: ["Enter"] } },
    );
    expect(merged.actions.enter).toEqual(["Enter"]);
  });
});
