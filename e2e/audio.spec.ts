import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Pre-generated speech, end to end (SPEC §5.6): an R2 object, the API route that serves
 * it, the player that renders only where a clip exists, and the listening item type that
 * exists *because* the audio is identical for every learner.
 *
 * The clip is `backend/seed/audio/fixture.mp3` — a valid silent stream put into the local
 * R2 bucket by `e2e/scripts/start-api.sh`. Workers AI is not in this loop on purpose: a
 * billed, remote, non-deterministic model call has no place in a commit gate.
 */

test.describe("audio delivery", () => {
  test("a generated clip is served with an immutable cache policy", async ({ request }) => {
    const res = await request.get("/api/audio/en/e2e-a1-0001.mp3");

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("audio/mpeg");
    // A key names one clip forever — regenerating writes a new key — so the response may
    // be cached for a year. Without this every card replays a Worker invocation.
    expect(res.headers()["cache-control"]).toContain("immutable");
    expect((await res.body()).byteLength).toBeGreaterThan(0);
  });

  test("a key with no object behind it is a 404, not an empty 200", async ({ request }) => {
    const res = await request.get("/api/audio/en/no-such-word.mp3");

    expect(res.status()).toBe(404);
  });

  test("the generate route refuses an unauthenticated caller", async ({ request }) => {
    const res = await request.post("/api/audio/generate", {
      data: { wordId: "e2e-a1-0002", kind: "word" },
      failOnStatusCode: false,
    });

    // 401 when a bucket is bound, 503 where one is not — never 200, and never a
    // synthesised clip for an anonymous caller. Both mean "not for you".
    expect([401, 503]).toContain(res.status());
  });
});

test.describe("the player renders only where there is a clip", () => {
  test("a word with audio shows the button and a word without shows nothing", async ({
    page,
  }) => {
    await page.goto(`/en/english/words/${SEED.audio.word}`);
    await expect(page.getByTestId("word-audio")).toBeVisible();

    // The state most of the corpus is in. An absent control, not a disabled one — a
    // greyed speaker on a beginner's first card reads as a broken app.
    await page.goto(`/en/english/words/${SEED.unit1.lastWord}`);
    await expect(page.getByTestId("word-audio")).toHaveCount(0);
  });
});

test.describe("listening items", () => {
  /**
   * The listening slot is item 5 of the schedule (`ITEM_TYPE_SCHEDULE` in
   * `backend/src/session.ts`), and `SEED.audio.listeningWord` is the word that lands there
   * in a fresh unit-1 session. Everything before it is answered normally to get there.
   */
  test("the fifth item asks the learner to listen, and withholds the word", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    for (let index = 0; index < SEED.audio.listeningItemIndex; index += 1) {
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("session-continue").click();
      } else {
        const type = await page.getByTestId("session-card").getAttribute("data-item-type");
        await page.getByTestId("session-option").first().click();
        if (type === "match-pairs") {
          await page.getByTestId("session-option").first().click();
        }
      }
      await expect(page.getByTestId("session-feedback")).toBeVisible();
      await page.getByTestId("session-continue").click();
    }

    const card = page.getByTestId("session-card");
    await expect(card).toHaveAttribute("data-item-type", "listen-choose");

    // The question is the sound: a player is present, and the English word is nowhere on
    // the card. Rendering it would hand over the answer.
    await expect(page.getByTestId("word-audio")).toBeVisible();
    await expect(card).not.toContainText(SEED.audio.listeningWord);

    // And it still grades: the item completes like any other.
    await page.getByTestId("session-option").first().click();
    await expect(page.getByTestId("session-feedback")).toBeVisible();
  });
});
