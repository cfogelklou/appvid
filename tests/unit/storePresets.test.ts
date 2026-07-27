import { describe, expect, it } from "vitest";
import { STORE_PRESETS } from "../../src/constants";

describe("Store Presets", () => {
  it("includes iOS and Android presets for portrait and landscape", () => {
    const ids = STORE_PRESETS.map((p) => p.id);
    expect(ids).toContain("appstore-portrait");
    expect(ids).toContain("appstore-landscape");
    expect(ids).toContain("google-play-portrait");
    expect(ids).toContain("google-play-landscape");
  });

  it("has correct dimensions for App Store and Google Play presets", () => {
    const appstorePortrait = STORE_PRESETS.find((p) => p.id === "appstore-portrait");
    expect(appstorePortrait).toBeDefined();
    expect(appstorePortrait?.width).toBe(886);
    expect(appstorePortrait?.height).toBe(1920);

    const googlePlayPortrait = STORE_PRESETS.find((p) => p.id === "google-play-portrait");
    expect(googlePlayPortrait).toBeDefined();
    expect(googlePlayPortrait?.width).toBe(1080);
    expect(googlePlayPortrait?.height).toBe(1920);
  });
});
