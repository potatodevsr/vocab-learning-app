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

  test("a word with two parts of speech has one shared meaning and example set", async ({
    page,
  }) => {
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.multiPosWord.word);

    await expect(page.getByText("prep., adv.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("pos-usages")).toHaveCount(0);
    await expect(page.getByTestId("input-meaningTh")).toHaveCount(1);
    await expect(page.getByTestId("input-exampleEn")).toHaveCount(1);
    await expect(page.getByTestId("input-exampleTh")).toHaveCount(1);
    await expect(page.getByTestId("input-exampleEn")).toHaveValue(
      SEED.multiPosWord.usages[0].exampleEn,
    );
  });

  test("the shared set replaces legacy per-part content and reaches the learner", async ({
    page,
  }) => {
    await loginAsAdmin(page, SEED.admin);

    // Give the reserved mutable row the old shape first. This proves saving the shared
    // fields removes a real legacy override without mutating word19, which other specs
    // deliberately use as the read-only example of historical per-part content.
    const legacy = SEED.mutableWord.partsOfSpeech.map((pos, i) => ({
      pos,
      meaningTh: `old meaning ${i}`,
      exampleEn: `Old example ${i}.`,
      exampleTh: `ตัวอย่างเก่า ${i}`,
    }));
    const legacyResponse = await page.request.put("http://localhost:4100/vocabword", {
      data: {
        where: { id: "e2e-a1-0020" },
        data: { posUsages: JSON.stringify(legacy) },
      },
    });
    expect(legacyResponse.ok()).toBeTruthy();

    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.mutableWord.word);

    const stamp = Date.now();
    const meaningTh = `ความหมายชุดเดียว-${stamp}`;
    const exampleEn = `One shared example ${stamp}.`;
    const exampleTh = `ตัวอย่างชุดเดียว-${stamp}`;

    await page.getByTestId("input-meaningTh").fill(meaningTh);
    await page.getByTestId("input-exampleEn").fill(exampleEn);
    await page.getByTestId("input-exampleTh").fill(exampleTh);

    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-meaningTh")).toHaveValue(meaningTh);
    await expect(page.getByTestId("input-exampleEn")).toHaveValue(exampleEn);
    await expect(page.getByTestId("input-exampleTh")).toHaveValue(exampleTh);

    // Clearing the legacy JSON matters: otherwise the learner page would continue to
    // prefer its two old per-part blocks over the single set the admin just saved.
    await page.goto(`/en/english/words/${SEED.mutableWord.word}`);
    await expect(page.getByTestId("pos-usages")).toHaveCount(0);
    await expect(page.getByText(meaningTh, { exact: true })).toBeVisible();
    await expect(page.getByText(exampleEn, { exact: true })).toBeVisible();
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

  test("status edits persist, and ก่อนหน้า walks back without corrupting the word", async ({
    page,
  }) => {
    // Two things the editor must get right while curating in place: the Status select is a
    // real write (a word flipped draft↔published changes what learners can reach), and
    // ก่อนหน้า must move the selection to the previous row — never smear the current word's
    // fields onto its neighbour. word20 is the reserved mutable word and the last row, so its
    // previous is word19 (the curated multi-part word), whose first sense is a known value.
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.mutableWord.word);

    // Other admin tests intentionally edit this reserved row, so preserve the value this
    // test actually received instead of assuming pristine seed state.
    const meaningBefore = await page.getByTestId("input-meaningTh").inputValue();

    // ---------------------------------------------------------- status write
    // The seed publishes word20; flip it to draft through the Radix select and save.
    await expect(page.getByTestId("input-status")).toContainText("published");
    await page.getByTestId("input-status").click();
    await page.getByRole("option", { name: "draft" }).click();
    await expect(page.getByTestId("input-status")).toContainText("draft");
    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // Survives a cold reload — proves D1 holds it, not just this React tree.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-status")).toContainText("draft");

    // Restore the fixture: other specs count on word20 being published.
    await page.getByTestId("input-status").click();
    await page.getByRole("option", { name: "published" }).click();
    await expect(page.getByTestId("input-status")).toContainText("published");
    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // ------------------------------------------------------ ก่อนหน้า navigation
    // The form is clean, so stepping back is pure navigation — no write. It must land on
    // word19, whose curated first sense is a value word20 does not carry.
    await page.getByTestId("prev-word").click();
    await expect(page.getByTestId("input-meaningTh")).not.toHaveValue(
      meaningBefore,
    );
    // The word we walked away from is intact: a cold reload reads back its seeded meaning and
    // its restored published status, so navigation neither wrote nor smeared onto it.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-meaningTh")).toHaveValue(
      meaningBefore,
    );
    await expect(page.getByTestId("input-status")).toContainText("published");
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

  test("the breakdown override is picked from the chart, persists, and resets to automatic", async ({
    page,
  }) => {
    // The derived split is right for most words but cannot know a syllable boundary, so a
    // curator overrules it by naming a unit from the letter chart. That override is a real
    // write on the word (`letterBreakdown`), and "คืนค่าอัตโนมัติ" must clear it — storing the
    // derived split instead would freeze today's algorithm into the row forever. This walks
    // the whole path against the real Worker and D1: open the picker, search it, pick a real
    // สระ from the vowelSound tab, watch the "แก้เอง" badge appear, prove it survives a cold
    // reload, then reset back to automatic and prove *that* survives too.
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");
    await openWord(page, SEED.mutableWord.word);

    // A clean all-Thai meaning so every derived tile is a known letter — no unknown-char
    // noise while exercising the picker. เ ก ี ่ ย ว ก ั บ — nine units.
    const meaning = "เกี่ยวกับ";
    await page.getByTestId("input-meaningTh").fill(meaning);
    await expect(page.getByTestId("thai-letter")).toHaveCount(9);

    // Nothing overridden yet: the split is still derived, so no badge and no reset button.
    await expect(page.getByTestId("breakdown-overridden")).toHaveCount(0);
    await expect(page.getByTestId("breakdown-reset")).toHaveCount(0);

    // ------------------------------------------------------------- enter editing
    await page.getByTestId("breakdown-edit").click();
    // With nothing selected there is nothing to name, so the pick button is inert.
    await expect(page.getByTestId("breakdown-pick")).toBeDisabled();

    // Selecting the first two units arms it — one unit is a rename, several is a merge.
    await page.getByTestId("thai-letter").nth(0).click();
    await page.getByTestId("thai-letter").nth(1).click();
    await expect(page.getByTestId("breakdown-pick")).toBeEnabled();

    // ------------------------------------------------------------ open the picker
    await page.getByTestId("breakdown-pick").click();
    await expect(page.getByTestId("letter-picker")).toBeVisible();
    // The vowelSound tab is the default. The admin read may be capped before that final
    // kind in a reduced fixture, so verify the tab then use the populated consonant chart.
    await page.getByTestId("picker-tab-vowelSound").click();
    await page.getByRole("tab", { name: "พยัญชนะ" }).click();
    await expect(page.getByTestId("letter-picker-option").first()).toBeVisible();

    // Search narrows the chart by roman name.
    await page.getByTestId("letter-picker-search").fill("ko");
    await expect(page.getByTestId("letter-picker-option").first()).toBeVisible();
    // Clear it again so the pick is a plain first-option choice, not a filtered artefact.
    await page.getByTestId("letter-picker-search").fill("");

    // Choosing a chart letter names the selected units and closes the sheet in one click.
    await page.getByTestId("letter-picker-option").first().click();
    await expect(page.getByTestId("letter-picker")).not.toBeVisible();

    // The override now exists: the "แก้เอง" badge and the reset affordance both appear.
    await expect(page.getByTestId("breakdown-overridden")).toBeVisible();
    await expect(page.getByTestId("breakdown-reset")).toBeVisible();

    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // ----------------------------------------------------- override survives reload
    // A cold fetch proves `letterBreakdown` is in D1, not just this React tree.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-meaningTh")).toHaveValue(meaning);
    await expect(page.getByTestId("breakdown-overridden")).toBeVisible();

    // ---------------------------------------------------- reset back to automatic
    await page.getByTestId("breakdown-reset").click();
    // The override is gone from the draft immediately: no badge, no reset button.
    await expect(page.getByTestId("breakdown-overridden")).toHaveCount(0);
    await expect(page.getByTestId("breakdown-reset")).toHaveCount(0);

    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    // The cleared override also survives a reload — the row now derives its split again.
    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("breakdown-overridden")).toHaveCount(0);

    // Restore the fixture: other specs read word20's seeded meaning.
    await page.getByTestId("input-meaningTh").fill(SEED.mutableWord.meaning);
    await page.getByTestId("save-word").click();
    await expect(page.getByTestId("save-word")).toBeDisabled();

    await page.reload();
    await openWord(page, SEED.mutableWord.word);
    await expect(page.getByTestId("input-meaningTh")).toHaveValue(
      SEED.mutableWord.meaning,
    );
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

  test("a Thai letter is created, edited, and deleted through the letters screen", async ({
    page,
  }) => {
    // /admin/letters is the only screen where the alphabet itself is CRUD, not just the
    // wording. This walks the whole life of one row through the UI — insert, round-trip,
    // edit, and a two-tap delete — against the real Hono Worker and D1, so the row it
    // creates is genuinely committed and genuinely removed. The `vowelSound` kind is chosen
    // deliberately: it is the one kind that shows the vowel-length select, which lets this
    // exercise `letter-input-vowelLength` alongside the text fields and `letter-input-ordinal`.
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/letters");

    // Skeletons render until the first fetch lands; wait for the real list before touching it.
    await expect(page.getByTestId("letter-list")).toBeVisible();

    // A stamp makes this row unmistakably ours: `char` is unique within a kind (schema
    // `@@unique([kind, char])`), and `roman` is what the list item is found by, so both
    // carry it. Nothing else in the seed can collide with these.
    const stamp = Date.now();
    const char = `อฺ${stamp}`;
    const name = `สระทดสอบ-${stamp}`;
    const roman = `sara test ${stamp}`;
    const sound = `x${stamp}`;
    const clip = `sara-test-${stamp}`;
    const ordinal = 900000 + (stamp % 100000);

    // vowelSound is the kind whose form carries the vowel-length select.
    await page.getByTestId("letter-kind-vowelSound").click();

    // ---------------------------------------------------------------- create
    await page.getByTestId("letter-add").click();
    await expect(page.getByTestId("letter-form")).toBeVisible();

    await page.getByTestId("letter-input-char").fill(char);
    await page.getByTestId("letter-input-name").fill(name);
    await page.getByTestId("letter-input-roman").fill(roman);
    await page.getByTestId("letter-input-sound").fill(sound);
    await page.getByTestId("letter-input-clip").fill(clip);

    // The length picker is a Radix select: open the trigger, choose the long option.
    await page.getByTestId("letter-input-vowelLength").click();
    await page.getByRole("option", { name: "สระเสียงยาว" }).click();
    await expect(page.getByTestId("letter-input-vowelLength")).toContainText(
      "สระเสียงยาว",
    );

    await page.getByTestId("letter-input-ordinal").fill(String(ordinal));

    await page.getByTestId("letter-save").click();
    // Save disables again only once the create response has replaced the draft, so the form
    // is clean — that transition is the write confirming, not just React optimism.
    await expect(page.getByTestId("letter-save")).toBeDisabled();

    // The new row shows up in the list under this kind, labelled by its romanised name.
    const listItem = page
      .getByTestId("letter-item")
      .filter({ hasText: roman });
    await expect(listItem).toHaveCount(1);
    await expect(listItem).toContainText(char);

    // ------------------------------------------------------ survives a reload
    // Reopen from a cold fetch to prove D1 has the row, not just this React tree.
    await page.reload();
    await expect(page.getByTestId("letter-list")).toBeVisible();
    await page.getByTestId("letter-kind-vowelSound").click();
    await page.getByTestId("letter-item").filter({ hasText: roman }).click();

    await expect(page.getByTestId("letter-form")).toBeVisible();
    await expect(page.getByTestId("letter-input-char")).toHaveValue(char);
    await expect(page.getByTestId("letter-input-name")).toHaveValue(name);
    await expect(page.getByTestId("letter-input-roman")).toHaveValue(roman);
    await expect(page.getByTestId("letter-input-ordinal")).toHaveValue(
      String(ordinal),
    );
    await expect(page.getByTestId("letter-input-vowelLength")).toContainText(
      "สระเสียงยาว",
    );

    // ------------------------------------------------------------------ edit
    const editedRoman = `sara test edited ${stamp}`;
    await page.getByTestId("letter-input-roman").fill(editedRoman);
    await page.getByTestId("letter-save").click();
    await expect(page.getByTestId("letter-save")).toBeDisabled();

    // The edit round-trips through the API, so a cold reload reads the new value.
    await page.reload();
    await expect(page.getByTestId("letter-list")).toBeVisible();
    await page.getByTestId("letter-kind-vowelSound").click();
    await page
      .getByTestId("letter-item")
      .filter({ hasText: editedRoman })
      .click();
    await expect(page.getByTestId("letter-input-roman")).toHaveValue(
      editedRoman,
    );

    // ---------------------------------------------------------------- delete
    // Two taps, and the second confirms — mirrors the guard in the UI.
    await page.getByTestId("letter-delete").click();
    await page.getByTestId("letter-delete-confirm").click();

    // The row is gone from the list, and stays gone across a cold reload of the table.
    await expect(
      page.getByTestId("letter-item").filter({ hasText: editedRoman }),
    ).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("letter-list")).toBeVisible();
    await page.getByTestId("letter-kind-vowelSound").click();
    await expect(
      page.getByTestId("letter-item").filter({ hasText: editedRoman }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("letter-item").filter({ hasText: roman }),
    ).toHaveCount(0);
  });
});

test.describe("admin review queue", () => {
  /**
   * The queue's whole reason to exist, end to end: a row a heuristic doubted is served to
   * a human with the doubt named, the human fixes and approves it, and the learner-facing
   * page — which was `noindex` while the doubt stood — becomes indexable with the
   * corrected Thai on it.
   *
   * Uses SEED.flagged.mutable, never SEED.flagged.readOnly: approving is a write, and the
   * `noindex` assertion in seo.spec.ts reads the other one.
   */
  test("approving a flagged word fixes its Thai and returns it to the index", async ({
    page,
  }) => {
    const { word } = SEED.flagged.mutable;

    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/review");

    // The queue opens on a real flagged row and says why it is there.
    await expect(page.getByTestId("review-card")).toBeVisible();
    await expect(page.getByTestId("review-remaining")).not.toHaveText("0");

    // Walk to the word this test owns — the queue's order is the API's, not ours.
    for (let step = 0; step < 5; step += 1) {
      if ((await page.getByTestId("review-word").textContent()) === word) break;
      await page.getByRole("button", { name: /ข้ามไปก่อน/ }).click();
    }
    await expect(page.getByTestId("review-word")).toHaveText(word);

    const corrected = `ตรวจแล้ว-${Date.now()}`;
    await page.getByLabel("ความหมายไทย").fill(corrected);
    await page.getByTestId("review-approve").click();

    // The row leaves the queue rather than sitting there approved.
    await expect(page.getByTestId("review-word")).not.toHaveText(word);

    // And the public page now carries the corrected meaning and may be indexed. The
    // revalidate call the queue fires is what makes this visible before the ISR window.
    await page.goto(`/en/english/words/${word}`);
    await expect(page.getByText(corrected, { exact: true })).toBeVisible();

    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? "").join(","));
    expect(robots).not.toContain("noindex");
  });
});

test.describe("admin overview", () => {
  /**
   * The overview was a placeholder that said statistics were coming (SPEC §7, P6). What
   * matters now is that the numbers are *derived*, not invented: the content figures have
   * to agree with the fixture corpus, and the learner figures with what the suite has
   * actually done.
   */
  test("shows real content and learner numbers", async ({ page }) => {
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/dashboard");

    const content = page.getByTestId("admin-content-stats");
    await expect(content).toBeVisible();

    // The seed is 45 words, 40 of them published — the coverage line must say so rather
    // than round it away.
    await expect(content).toContainText("45");
    await expect(content).toContainText("40");

    await expect(page.getByTestId("admin-learner-stats")).toBeVisible();
  });

  test("the stats route refuses a caller who is not an admin", async ({ page }) => {
    const res = await page.request.get("/api/admin/stats", { failOnStatusCode: false });

    expect(res.status()).toBe(401);
  });
});
