"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { track } from "@/lib/analytics";
import { safeReturnPath } from "@/lib/return-path";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { userRegister, userLogin } from "@/lib/user-api";
import { claimPractice, PracticeApiError } from "@/lib/practice-api";
import Link from "next/link";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
};

const INITIAL_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
};

/**
 * The browser's IANA time zone, captured silently at registration
 * (LEARNER-LIFECYCLE.md §3.4 / SPEC.md OQ7) — never a form field. Falls back to
 * `Asia/Bangkok` (the primary Thai audience's zone) if the runtime can't resolve one, which
 * matches the API's own default so a missing value is handled identically on both sides.
 */
const resolveBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok";
  } catch {
    return "Asia/Bangkok";
  }
};

/** The rule is code; its label is copy, and copy lives in `messages/*.json`. */
const PASSWORD_RULES = [
  { key: "Length", test: (p: string) => p.length >= 8 && p.length <= 15 },
  { key: "Digit", test: (p: string) => /\d/.test(p) },
  { key: "Upper", test: (p: string) => /[A-Z]/.test(p) },
  { key: "Lower", test: (p: string) => /[a-z]/.test(p) },
  { key: "Special", test: (p: string) => /[!@#$*&]/.test(p) },
] as const;

type RegisterFormProps = {
  /**
   * The validated return target, already resolved server-side by `safeReturnPath`
   * (`app/[locale]/auth/register/page.tsx`) — never the raw, attacker-controllable query
   * value. `null` when there is none.
   */
  from: string | null;
};

export function RegisterForm({ from }: RegisterFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const startedRef = useRef(false);

  const passwordResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        passed: rule.test(form.password),
      })),
    [form.password]
  );

  const isFormValid = useMemo(
    () =>
      form.firstName.trim() !== "" &&
      form.lastName.trim() !== "" &&
      form.email.trim() !== "" &&
      form.username.trim() !== "" &&
      passwordResults.every((r) => r.passed),
    [form, passwordResults]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // "Started filling the form" is the honest start of the signup funnel — distinct from
    // the page view, and fired once (docs/LEARNER-LIFECYCLE.md §7.1).
    if (!startedRef.current) {
      startedRef.current = true;
      track("signup_started", { locale: locale === "th" ? "th" : "en" });
    }
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await userRegister({ ...form, timezone: resolveBrowserTimezone() });
      await userLogin({ email: form.email, password: form.password });
      track("signup_completed", { locale: locale === "th" ? "th" : "en" });

      // Idempotent by trial id (docs/LEARNER-LIFECYCLE.md §3.2-3.3). A signed-in
      // learner with no pending trial claim cookie gets an expected 400/404 here — that
      // is not a signup failure and must never block the redirect below. Anything else
      // (a network failure, a 5xx) is logged rather than silently discarded, so a real
      // dead end shows up in diagnostics instead of just looking like an untaken trial;
      // the learner still keeps the account they just created either way, and the
      // practice result screen retries the same idempotent call if they land back on it.
      try {
        await claimPractice();
      } catch (claimErr) {
        const expected = claimErr instanceof PracticeApiError && [400, 404].includes(claimErr.status);
        if (!expected) console.error("[practice-claim-after-signup]", claimErr);
      }

      setSuccess(true);
      // Return the learner to where they were headed, never blindly to `/` — but only to
      // a target we have proven safe (docs/LEARNER-LIFECYCLE.md §3.3). `from` was already
      // validated server-side; re-validate here too since it still crosses a client
      // boundary before reaching the router.
      router.push(safeReturnPath(from, locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.generic"));
      setLoading(false);
    }
  };

  if (loading || success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-white" />
          <p className="text-sm text-white">
            {success ? t("loadingRegisterSuccess") : t("loadingRegister")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="play-sticker gap-0 rounded-[28px] border-0 [--tile-block:var(--ink)]">
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          autoComplete="off"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("firstName")}</Label>
              <Input
                id="firstName"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                autoComplete="off"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("lastName")}</Label>
              <Input
                id="lastName"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">{t("username")}</Label>
            <Input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder="yourname"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            {form.password.length > 0 && (
              <ul className="space-y-1 mt-2">
                {passwordResults.map((rule) => (
                  <li
                    key={rule.key}
                    className={`flex items-center gap-1.5 text-xs ${
                      rule.passed ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    <span aria-hidden>{rule.passed ? "✓" : "○"}</span>
                    {t(`passwordRule${rule.key}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="play-key h-14 w-full rounded-2xl bg-brand text-base font-extrabold text-white hover:bg-brand" disabled={!isFormValid}>
            {t("submit")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <Link
              href={
                from
                  ? `/${locale}/auth/login?from=${encodeURIComponent(from)}`
                  : `/${locale}/auth/login`
              }
              className="play-focus font-semibold text-brand underline-offset-4 hover:underline"
            >
              {t("signIn")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
