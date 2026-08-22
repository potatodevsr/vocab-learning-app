import { expect, test } from "@playwright/test";

import { audioUrl } from "../../lib/audio";

test.describe("audio urls", () => {
  test("a stored key becomes a same-origin path", () => {
    // Same origin, so no CORS preflight on a media request and no second hostname to keep
    // in sync when the api Worker moves.
    expect(audioUrl("audio/en/word1.mp3")).toBe("/api/audio/en/word1.mp3");
  });

  test("no key means no player", () => {
    expect(audioUrl("")).toBeNull();
    expect(audioUrl("   ")).toBeNull();
    expect(audioUrl(null)).toBeNull();
    expect(audioUrl(undefined)).toBeNull();
  });

  test("a key outside the audio namespace is refused", () => {
    // A corrupted row must not be able to turn this helper into an open proxy to the API.
    expect(audioUrl("progress/summary")).toBeNull();
    expect(audioUrl("../user/me")).toBeNull();
  });
});
