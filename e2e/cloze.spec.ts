import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * The cloze item: the example sentence with the word taken out of it.
 *
 * Recognition and recall both ask what a word means on its own. This asks where it
 * belongs, which is the thing a learner has to do to actually use it — and it is the only
 * item type that depends on `exampleEn`, so it also proves the column is reaching the
 * session rather than sitting unread in the database.
 *
 * It occupies the last slot of the schedule (`ITEM_TYPE_SCHEDULE` in
 * `backend/src/session.ts`), and falls back to a meaning question for any word whose
 * example is missing or does not contain the headword as its own word.
 */

test("the last item of a session is the word missing from its own sentence", async ({
  page,
}) => {
  await registerThroughUi(page);
  await page.goto("/en/learn?level=A1&unit=1");
  await expect(page.getByTestId("session-card")).toBeVisible();

  // Answer the first seven items to reach the cloze slot.
  for (let index = 0; index < 7; index += 1) {
    const spelling = page.getByTestId("session-spelling-input");
    if (await spelling.isVisible().catch(() => false)) {
      await spelling.fill("placeholder");
      await page.getByTestId("session-continue").click();
    } else {
      const type = await page.getByTestId("session-card").getAttribute("data-item-type");
      await page.getByTestId("session-option").first().click();
      if (type === "match-pairs") await page.getByTestId("session-option").first().click();
    }
    await expect(page.getByTestId("session-feedback")).toBeVisible();
    await page.getByTestId("session-continue").click();
  }

  const card = page.getByTestId("session-card");
  await expect(card).toHaveAttribute("data-item-type", "cloze");

  // The sentence is on the card…
  const prompt = page.getByTestId("session-prompt");
  await expect(prompt).toContainText("is an example sentence for");

  // …and the word it teaches is not, or the question answers itself. Every fixture word
  // matches `wordN`, so this checks the blank really was cut out of the prompt.
  await expect(prompt).not.toContainText(/word\d+/);

  // The options are English words rather than Thai meanings — the question is which word
  // fills the gap.
  await expect(page.getByTestId("session-option").first()).toContainText(/word\d+/);

  await page.getByTestId("session-option").first().click();
  await expect(page.getByTestId("session-feedback")).toBeVisible();
  await page.getByTestId("session-continue").click();

  // And it counts: eight items answered ends the session like any other run.
  await expect(page.getByTestId("session-result")).toBeVisible();
  expect(SEED.unit1.firstExampleEn).toContain(SEED.unit1.firstWord);
});
