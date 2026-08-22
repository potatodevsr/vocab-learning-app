"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { track } from "@/lib/analytics";
import { safeReturnPath } from "@/lib/return-path";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { userRegister, userLogin } from "@/lib/user-api";
import { claimPractice, PracticeApiError } from "@/lib/practice-api";
import Link from "next/link";
import { GoogleButton, AuthDivider } from "@/components/auth/google-button";

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

/**
 * The rule is code; its label is copy, and copy lives in `messages/*.json`.
 *
 * The upper bound used to be 15 and the special set used to be exactly `!@#$*&`. Together
 * those rejected most of what a password manager generates — a 20-character string, or one
 * containing `%` or `^` — which pushes people towards a weaker password they typed
 * themselves. A ceiling buys nothing either way: the value is hashed to a fixed length, so
 * a long passphrase costs the same to store as a short one. 64 is high enough to accept
 * anything a manager produces and low enough to bound the hash input.
 */
const PASSWORD_RULES = [
  { key: "Length", test: (p: string) => p.length >= 8 && p.length <= 64 },
  { key: "Digit", test: (p: string) => /\d/.test(p) },
  { key: "Upper", test: (p: string) => /[A-Z]/.test(p) },
  { key: "Lower", test: (p: string) => /[a-z]/.test(p) },
  { key: "Special", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const from = safeReturnPath(searchParams.get("from"), locale);
  const t = useTranslations("Auth");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const startedRef = useRef(false);

  const passwordResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        passed: rule.test(form.password),
      })),
    [form.password]
  );

  // Name is not required to learn vocabulary, so it no longer blocks the button.
  const isFormValid = useMemo(
    () =>
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
      // Timezone and locale are both captured here, silently: the learner is registering in
      // a language and a place, and neither is worth a form field (LEARNER-LIFECYCLE.md
      // §3.4). They are read back only by the cron-sent reminder and the push text, which
      // have no request to infer either from.
      await userRegister({
        ...form,
        timezone: resolveBrowserTimezone(),
        locale,
      });
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
      // a target we have proven safe (docs/LEARNER-LIFECYCLE.md §3.3). The query value is
      // attacker-controlled, so `safeReturnPath` validates it before it reaches router.
      router.push(from);
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
      <CardContent className="space-y-4 pt-6">
        {/* One tap, and it fills in the name and email this form would otherwise ask for. */}
        <GoogleButton from={from ?? undefined} />

        <AuthDivider />

        {/*
          Autofill is on, on purpose.

          Every field here carried `autoComplete="off"`, including the form itself, so a
          phone offered to fill in none of them. On mobile — which is the baseline for this
          audience — autofill is most of the difference between a signup that completes and
          one that gets abandoned at the keyboard. Only the password is special-cased, as
          `new-password`, which is what tells a password manager to offer a fresh one
          rather than an existing login.
        */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                {t("firstName")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({t("optionalLabel")})
                </span>
              </Label>
              <Input
                id="firstName"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">
                {t("lastName")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({t("optionalLabel")})
                </span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            {/*
              `autoFocus` moved here from the first name field. Focus belongs on the first
              thing the form actually requires, not on an optional one — and on a phone it
              decides which field the keyboard opens against.
            */}
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
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
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>

            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-describedby="password-rules"
                className="pe-12"
                required
              />

              {/*
                A reveal toggle. Without one, the only way to check a typo in a password
                you are inventing is to clear the field and start again — on a phone
                keyboard, in a second language.
              */}
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                aria-pressed={showPassword}
                className="play-focus absolute end-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-5" aria-hidden />
                ) : (
                  <Eye className="size-5" aria-hidden />
                )}
              </button>
            </div>

            {/*
              The rules are stated before they are broken.

              They used to appear only once `password.length > 0`, so someone arriving at
              the form saw a submit button that was disabled for reasons the page had not
              mentioned. Requirements are part of the question, not part of the error.
            */}
            <div id="password-rules">
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {t("passwordRulesTitle")}
              </p>
              <ul className="mt-1 space-y-1">
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
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/*
            The button names the outcome. It said "Confirm" — a word that describes a
            dialog, not an account — on a page the visitor reached by pressing
            "สมัครสมาชิก" in the header and titled "สมัครสมาชิก". Three names for one act.
          */}
          <Button
            type="submit"
            className="play-key h-14 w-full rounded-2xl bg-brand text-base font-extrabold text-white hover:bg-brand"
            disabled={!isFormValid}
          >
            {t("registerSubmit")}
          </Button>

          {/*
            The two documents someone is agreeing to, at the moment they agree to them.
            Both pages existed; neither was linked from the form that binds you to them.
          */}
          <p className="text-center text-xs text-muted-foreground">
            {t.rich("legalNotice", {
              terms: (chunks) => (
                <Link prefetch={false} href={`/${locale}/terms`} className="play-underline font-semibold">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link prefetch={false} href={`/${locale}/privacy`} className="play-underline font-semibold">
                  {chunks}
                </Link>
              ),
            })}
          </p>

          <p className="text-center text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <Link
              prefetch={false}
              href={
                searchParams.has("from")
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
