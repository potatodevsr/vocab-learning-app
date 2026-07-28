import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

test.describe("profile", () => {
  test("shows the signed-in account's real details", async ({ page }) => {
    const user = await registerThroughUi(page);

    await page.goto("/en/profile");

    await expect(page.getByTestId("profile-username")).toHaveText(
      user.username,
    );
    await expect(page.getByTestId("profile-email")).toHaveText(user.email);
    await expect(page.getByTestId("profile-name")).toHaveText(
      `${user.firstName} ${user.lastName}`,
    );
    // createdAt comes from the API, so a rendered join date proves /user/me was really
    // called server-side with the caller's cookie.
    await expect(page.getByTestId("profile-member-since")).not.toBeEmpty();
  });

  test("is reachable from the account menu", async ({ page }) => {
    const user = await registerThroughUi(page);

    await page.getByText(user.username).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();

    await expect(page).toHaveURL(/\/en\/profile/);
    await expect(page.getByTestId("profile-email")).toHaveText(user.email);
  });

  // The empty-state / real-stats behaviour lives in progress.spec.ts, which owns the
  // persistence story end to end.

  test("anonymous visitors are redirected to login", async ({ page }) => {
    await page.goto("/en/profile");

    await expect(page).toHaveURL(/\/en\/auth\/login\?from=/);
  });

  test("renders in Thai too", async ({ page }) => {
    const user = await registerThroughUi(page);

    await page.goto("/th/profile");

    await expect(page.getByText("ข้อมูลบัญชี")).toBeVisible();
    await expect(page.getByTestId("profile-email")).toHaveText(user.email);
  });
});
