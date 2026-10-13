import { expect, test } from "@playwright/test";
import { localeHref } from "../../lib/locale-href";

test("locale links preserve allowed state and translate safe return paths", () => {
  const from = "/en/learn?level=A1&unit=45&mode=review";
  const href = localeHref("/auth/login", new URLSearchParams({ from, token: "secret" }).toString(), "th");
  expect(new URL(href, "https://example.test").searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
  expect(href).not.toContain("secret");
  expect(localeHref("/english/search", "q=about&token=secret", "en")).toBe("/en/english/search?q=about");
});

test("unsafe and locale-less return paths stay on the target locale", () => {
  for (const from of ["https://evil.example", "//evil.example", "/en/auth/login", "/auth/login"]) {
    expect(localeHref("/auth/login", new URLSearchParams({ from }).toString(), "th"))
      .toBe("/th/auth/login?from=%2Fth");
  }
  expect(localeHref("/auth/login", "from=%2Flearn%3Funit%3D2", "th"))
    .toBe("/th/auth/login?from=%2Fth%2Flearn%3Funit%3D2");
});
