import { expect, test } from "@playwright/test";

import { loginAsAdmin, registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

test.describe("admin", () => {
  test("editing a word through the UI really commits to the database", async ({
    page,
  }) => {
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/vocabulary");

    // Deliberately the reserved mutable word — see SEED.mutableWord.
    const row = page
      .locator("tr", { hasText: SEED.mutableWord.word })
      .first();
    await expect(row).toBeVisible();

    const updated = `แก้ไขแล้ว-${Date.now()}`;
    await row.getByTestId("cell-meaningTh").click();

    const editor = row.getByTestId("input-meaningTh");
    await editor.fill(updated);
    await editor.press("Enter");

    // The input closes only after the API confirms the write, so waiting for the cell to
    // become plain text is the assertion that the save actually succeeded.
    await expect(editor).toBeHidden();
    await expect(row.getByText(updated)).toBeVisible();

    // Reload from the API — proves it was persisted, not just held in React state.
    await page.reload();
    await expect(page.getByText(updated)).toBeVisible();

    // And the learner side sees the new value on its next request.
    await page.goto(`/en/english/words/${SEED.mutableWord.word}`);
    await expect(page.getByText(updated, { exact: true })).toBeVisible();
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
