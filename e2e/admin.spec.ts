import { expect, test, type Page } from "@playwright/test";

import { loginAsAdmin, registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/** Pick a word out of the master list and wait for its form to mount. */
const openWord = async (page: Page, word: string) => {
  await page.getByTestId("word-item").filter({ hasText: word }).first().click();
  await expect(page.getByTestId("input-meaningTh")).toBeVisible();
};

test.describe("admin", () => {
  test("editing a word through the UI really commits to the database", async ({
    page,
  }) => {
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");

    // Deliberately the reserved mutable word — see SEED.mutableWord.
    await openWord(page, SEED.mutableWord.word);

    const updated = `แก้ไขแล้ว-${Date.now()}`;
    await page.getByTestId("input-meaningTh").fill(updated);
    await page.getByTestId("save-word").click();

    // The button goes back to disabled only when the form is clean again, which happens
    // once the API's response has replaced the draft — so this is the write confirming.
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // Reload from the API — proves it was persisted, not just held in React state.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-meaningTh")).toHaveValue(updated);

    // And the learner side sees the new value on its next request.
    await page.goto(`/en/english/words/${SEED.mutableWord.word}`);
    await expect(page.getByText(updated, { exact: true })).toBeVisible();
  });

  test("the Thai reading fields are editable and reach the learner", async ({
    page,
  }) => {
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.mutableWord.word);

    const stamp = Date.now();
    const reading = `วัด-ทะ-นะ-ทำ-${stamp}`;
    const roman = `Wat-tha-na-tham-${stamp}`;

    await page.getByTestId("input-meaningThReading").fill(reading);
    await page.getByTestId("input-meaningThRoman").fill(roman);
    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // Both fields survive a round trip through the API, not just React state.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-meaningThReading")).toHaveValue(
      reading,
    );
    await expect(page.getByTestId("input-meaningThRoman")).toHaveValue(roman);

    // And a learner reading English sees them on the word page.
    await page.goto(`/en/english/words/${SEED.mutableWord.word}`);
    const card = page.getByTestId("thai-reading").first();
    await expect(card).toContainText(reading);
    await expect(card).toContainText(roman);
  });

  test("a word with two parts of speech is curated one part at a time", async ({
    page,
  }) => {
    // `across` is `prep., adv.` and the two senses need different sentences — "she walked
    // across the street" versus "the shop is across the street". One shared example box
    // can only hold one of them, so it is replaced by a block per part of speech.
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.multiPosWord.word);

    const blocks = page.getByTestId("pos-usage");
    await expect(blocks).toHaveCount(SEED.multiPosWord.usages.length);

    // ...and the shared pair is gone, rather than sitting there as a third place to type
    // the same sentence.
    await expect(page.getByTestId("input-exampleEn")).toHaveCount(0);

    for (const [i, usage] of SEED.multiPosWord.usages.entries()) {
      await expect(blocks.nth(i).getByTestId("pos-usage-heading")).toContainText(
        `(${usage.pos})`,
      );
      await expect(page.getByTestId(`input-pos-${i}-meaningTh`)).toHaveValue(
        usage.meaningTh,
      );
      await expect(page.getByTestId(`input-pos-${i}-exampleEn`)).toHaveValue(
        usage.exampleEn,
      );
      await expect(page.getByTestId(`input-pos-${i}-exampleTh`)).toHaveValue(
        usage.exampleTh,
      );
    }

    // A word with one part of speech is untouched by any of this.
    await openWord(page, SEED.unit1.firstWord);
    await expect(page.getByTestId("pos-usages")).toHaveCount(0);
    await expect(page.getByTestId("input-exampleEn")).toHaveValue(
      SEED.unit1.firstExampleEn,
    );
  });

  test("both parts of speech survive the round trip and reach the learner", async ({
    page,
  }) => {
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.mutableWord.word);

    const stamp = Date.now();
    const typed = SEED.mutableWord.partsOfSpeech.map((pos, i) => ({
      pos,
      meaningTh: `ความหมาย-${pos}-${stamp}`,
      exampleEn: `Sentence ${i + 1} for ${pos} ${stamp}.`,
      exampleTh: `ประโยค-${pos}-${stamp}`,
    }));

    for (const [i, usage] of typed.entries()) {
      await page.getByTestId(`input-pos-${i}-meaningTh`).fill(usage.meaningTh);
      await page.getByTestId(`input-pos-${i}-exampleEn`).fill(usage.exampleEn);
      await page.getByTestId(`input-pos-${i}-exampleTh`).fill(usage.exampleTh);
    }

    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // The whole array came back from the API, not just React state.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    for (const [i, usage] of typed.entries()) {
      await expect(page.getByTestId(`input-pos-${i}-meaningTh`)).toHaveValue(
        usage.meaningTh,
      );
      await expect(page.getByTestId(`input-pos-${i}-exampleEn`)).toHaveValue(
        usage.exampleEn,
      );
    }

    // And the learner sees both senses, not just the first one.
    await page.goto(`/en/english/words/${SEED.mutableWord.word}`);
    const shown = page.getByTestId("pos-usage");
    await expect(shown).toHaveCount(typed.length);
    for (const [i, usage] of typed.entries()) {
      await expect(shown.nth(i)).toContainText(usage.meaningTh);
      await expect(shown.nth(i)).toContainText(usage.exampleEn);
    }
  });

  test("stepping to the next word saves the one you were on", async ({
    page,
  }) => {
    // The screen exists to walk thousands of rows in order, so "ถัดไป" commits rather
    // than discarding — losing an entry to the wrong button would be its worst failure.
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.mutableWord.word);

    const note = `บันทึกอัตโนมัติ-${Date.now()}`;
    await page.getByTestId("input-meaningThReading").fill(note);
    await page.getByTestId("next-word").click();

    // We moved on: the form is now a different word, and it is clean.
    await expect(page.getByTestId("input-meaningThReading")).not.toHaveValue(note);
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // ...and the edit we walked away from was committed, not dropped.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-meaningThReading")).toHaveValue(note);
  });

  test("the list keeps lesson order, and a save does not reshuffle it", async ({
    page,
  }) => {
    // Ordering is level → unit → sourceOrder, so the list reads the way a learner meets
    // the words. The failure this guards against is ordering by `updatedAt`: every save
    // would then jerk the row you just edited to one end, under the cursor of someone
    // trying to walk 3,752 rows in sequence.
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");

    // The list renders skeletons until the first fetch lands, so wait for real rows —
    // otherwise this reads an empty list and "passes" or fails for the wrong reason.
    await expect(page.getByTestId("word-label").first()).toBeVisible();

    const firstThree = async () =>
      (await page.getByTestId("word-label").allInnerTexts())
        .slice(0, 3)
        .map((text) => text.trim());

    expect(await firstThree()).toEqual(["word1", "word2", "word3"]);

    await openWord(page, SEED.mutableWord.word);
    await page.getByTestId("input-meaningThReading").fill(`ลำดับ-${Date.now()}`);
    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    expect(await firstThree()).toEqual(["word1", "word2", "word3"]);
  });

  test("the letter breakdown derives itself from the Thai meaning", async ({
    page,
  }) => {
    // Nothing types or clicks this into existence — it is a pure function of meaningTh,
    // which is why it cannot drop a letter the way a hand-entered list does.
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.mutableWord.word);

    await page.getByTestId("input-meaningTh").fill("เกี่ยวกับ");

    // เ ก ี ่ ย ว ก ั บ — nine letters, updating live, with no save in between.
    await expect(page.getByTestId("thai-letter")).toHaveCount(9);
    await expect(page.getByTestId("thai-breakdown")).toContainText("9 ตัว");

    // The label under each letter is the romanised name from the ThaiLetter table, not the
    // Thai one. The audience for this breakdown cannot read Thai script — that is the whole
    // reason it exists — so `สระเอ` under `เ` was a second wall, not a hint. These come from
    // D1 rather than a constant, which is what lets /admin/letters change them.
    const romans = page.getByTestId("thai-letter-roman");
    await expect(romans.first()).toHaveText("sara e");
    await expect(romans.nth(1)).toHaveText("ko kai");
    await expect(romans.nth(3)).toHaveText("mai ek");
    await expect(page.getByTestId("thai-breakdown")).not.toContainText("สระเอ");

    // A character outside the Thai table is called out rather than passed through.
    await page.getByTestId("input-meaningTh").fill("เกี่ยวX");
    await expect(page.getByTestId("thai-breakdown")).toContainText(
      "ไม่ใช่อักษรไทย",
    );

    // Leave the fixture as we found it — other specs read this word.
    await page.getByTestId("input-meaningTh").fill(SEED.mutableWord.meaning);
    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();
  });

  test("a wrong password is reported as a wrong password", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#username", SEED.admin.username);
    await page.fill("#password", "not-the-password");
    await page.click('button[type="submit"]');

    await expect(page.getByText("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("an unreachable API is not blamed on the password", async ({ page }) => {
    // The one mocked request in the suite, and it earns it: the real failure needs the
    // api Worker stopped, which every other test in this file shares. A stopped Worker
    // surfaces as a 502 from the /api forwarder, so this reproduces that exactly.
    // Without the status check in the login page, this said "wrong username or password"
    // for a correct credential — which is how a working login looks forgotten.
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ message: "The API is unreachable." }),
      }),
    );

    await page.goto("/admin/login");
    await page.fill("#username", SEED.admin.username);
    await page.fill("#password", SEED.admin.password);
    await page.click('button[type="submit"]');

    await expect(page.getByText(/ติดต่อ API ไม่สำเร็จ/)).toBeVisible();
    await expect(
      page.getByText("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"),
    ).toHaveCount(0);
  });

  test("the admin area rejects anonymous visitors", async ({ page }) => {
    await page.goto("/admin/vocabulary");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a learner token cannot be replayed as an admin token", async ({
    page,
    context,
  }) => {
    // Both cookies are signed with the same secret, so verifying the signature alone is
    // not enough — proxy.ts must check the `role` claim. Before that check existed, this
    // served the admin UI with HTTP 200 to any signed-in learner.
    await registerThroughUi(page);

    const cookies = await context.cookies();
    const userToken = cookies.find((c) => c.name === "user_token")?.value;
    expect(userToken, "registration should have set a user_token").toBeTruthy();

    await context.clearCookies();
    await context.addCookies([
      {
        name: "admin_token",
        value: userToken as string,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/vocabulary");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("user list never exposes password hashes", async ({ page }) => {
    await loginAsAdmin(page, SEED.admin);

    // page.request shares the browser's cookie jar; the bare `request` fixture does not.
    const response = await page.request.get("http://localhost:4100/user");
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).not.toContain("password");
    expect(body).not.toContain("pbkdf2$");
  });
});
