import { describe, expect, it } from "vitest";
import { safeLicensedAudioUrl } from "./ephinta-config";

describe("safeLicensedAudioUrl", () => {
  it("accepts a same-origin path for a rights-cleared hosted track", () => {
    expect(safeLicensedAudioUrl("/media/licensed-event-track.mp3")).toBe("/media/licensed-event-track.mp3");
  });

  it("accepts an HTTPS source", () => {
    expect(safeLicensedAudioUrl("https://media.example.test/ephinta-track.mp3")).toBe("https://media.example.test/ephinta-track.mp3");
  });

  it.each([
    "",
    "   ",
    "http://media.example.test/track.mp3",
    "//media.example.test/track.mp3",
    "javascript:alert(1)",
    "data:audio/mpeg;base64,AAAA",
  ])("rejects unsafe or empty source %s", (source) => {
    expect(safeLicensedAudioUrl(source)).toBeNull();
  });
});
