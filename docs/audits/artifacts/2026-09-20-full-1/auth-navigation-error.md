# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation-continuity.spec.ts >> auth language switch localizes and preserves the requested session
- Location: e2e/navigation-continuity.spec.ts:13:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/th\/auth\/login\?from=/
Received string:  "http://localhost:3100/en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    24 × unexpected value "http://localhost:3100/en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview"

```

```yaml
- link "Skip to content":
  - /url: "#main"
- link "Back to home":
  - /url: /en
- link "EN":
  - /url: /en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview
- link "TH":
  - /url: /th/auth/login?from=%2Fth%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview
- heading "Sign in" [level=1]
- paragraph: Use your password, Google, or a secure email link.
- link "Continue with Google":
  - /url: /api/user/google/start?locale=en&from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview
- text: Email
- textbox "Email":
  - /placeholder: you@example.com
- text: Password
- textbox "Password"
- button "Log in with password"
- button "Email me a sign-in link"
- paragraph:
  - text: Don't have an account?
  - link "Register":
    - /url: /en/auth/register?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview
- alert
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | test("locale switching keeps search and header authentication intent", async ({ page }) => {
  4  |   await page.goto("/en/english/search?q=about");
  5  |   const switcher = page.getByRole("banner").getByRole("link", { name: "TH", exact: true });
  6  |   await expect(switcher).toHaveAttribute("href", "/th/english/search?q=about");
  7  |   await switcher.click();
  8  |   await expect(page).toHaveURL(/\/th\/english\/search\?q=about$/);
  9  |   const login = page.locator('a[href*="/auth/login?from="]').first();
  10 |   await expect(login).toHaveAttribute("href", "/th/auth/login?from=%2Fth%2Fenglish%2Fsearch%3Fq%3Dabout");
  11 | });
  12 |
  13 | test("auth language switch localizes and preserves the requested session", async ({ page }) => {
  14 |   await page.goto("/en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview");
  15 |   await page.getByRole("link", { name: "TH", exact: true }).click();
> 16 |   await expect(page).toHaveURL(/\/th\/auth\/login\?from=/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  17 |   expect(new URL(page.url()).searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
  18 |   await page.getByRole("link", { name: "TH", exact: true }).click();
  19 |   expect(new URL(page.url()).searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
  20 | });
  21 |
```