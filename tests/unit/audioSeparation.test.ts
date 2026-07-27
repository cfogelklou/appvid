import { describe, expect, it } from "vitest";
import type { ExportSettings } from "../../src/types";

describe("Audio Separation Model Settings", () => {
  it("defaults to separated audio separation mode", () => {
    const settings: ExportSettings = {
      presetId: "portrait",
      width: 1080,
      height: 1920,
      fitMode: "fit",
      originalAudioMode: "mute",
      audioSeparationMode: "separated",
      quality: "high",
    };

    expect(settings.audioSeparationMode).toBe("separated");
    expect(settings.originalAudioMode).toBe("mute");
  });

  it("allows setting embedded audio separation mode", () => {
    const settings: ExportSettings = {
      presetId: "portrait",
      width: 1080,
      height: 1920,
      fitMode: "fit",
      originalAudioMode: "keep",
      audioSeparationMode: "embedded",
      quality: "high",
    };

    expect(settings.audioSeparationMode).toBe("embedded");
    expect(settings.originalAudioMode).toBe("keep");
  });
});
