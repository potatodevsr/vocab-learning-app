"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMagicLink, userLogin } from "@/lib/user-api";
import { GoogleButton, AuthDivider } from "@/components/auth/google-button";
import { safeReturnPath } from "@/lib/return-path";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function LoginForm() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeReturnPath(searchParams.get("from"), locale);
  const errorCode = searchParams.get("error");
  const googleFailed = errorCode === "google";
  const googleUnavailable = errorCode === "google_unavailable";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"password" | "magic" | null>(null);
  const [sent, setSent] = useState(false);
  const [magicUnavailable, setMagicUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);

  const validateEmail = () => {
    if (isValidEmail(email)) return true;
    setError(t("validation.emailInvalidText"));
    return false;
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validateEmail()) return;
    if (!password) return setError(t("validation.passwordRequiredText"));

    setPending("password");
    try {
      await userLogin({ email: email.trim(), password });
      router.push(from);
      router.refresh();
    } catch {
      setError(t("error.loginFailed"));
      setPending(null);
    }
  };

  const submitMagicLink = async () => {
    setError(null);
    if (!validateEmail()) return;

    setPending("magic");
    try {
      const result = await requestMagicLink({
        email: email.trim(),
        locale,
        from,
      });
      setDevMagicLink(result.devMagicLink ?? null);
      setSent(true);
    } catch {
      setMagicUnavailable(true);
      setError(t("magicUnavailable"));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="play-sticker gap-0 rounded-[28px] border-0 [--tile-block:var(--ink)]">
      <CardContent className="pt-6">
        {sent ? (
          <div className="space-y-5 text-center" data-testid="magic-link-sent">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <div>
              <h2 className="text-xl font-extrabold">{t("magicSentTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("magicSentBody", { email: email.trim() })}</p>
            </div>
            {devMagicLink && (
              <Button asChild className="play-key h-12 w-full rounded-2xl bg-brand font-extrabold text-white hover:bg-brand">
                <a href={devMagicLink} data-testid="dev-magic-link">{t("magicOpenDev")}</a>
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>{t("magicTryAnother")}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google first: it is one tap, and the email route below asks the learner to
                leave the app and come back from their inbox. */}
            {googleFailed && (
              <p
                role="alert"
                data-testid="google-error"
                className="rounded-2xl border-3 border-ink bg-warn px-4 py-3 text-sm font-semibold text-ink"
              >
                {t("googleError")}
              </p>
            )}

            {googleUnavailable ? (
              /*
                A sign-in button that can only fail is worse than no sign-in button. When
                Google is not configured the email route below is the whole offer, so the
                divider goes too rather than heading an empty alternative.
              */
              <p
                role="status"
                data-testid="google-unavailable"
                className="rounded-2xl border-3 border-ink bg-brand-soft px-4 py-3 text-sm font-semibold text-ink"
              >
                {t("googleUnavailable")}
              </p>
            ) : (
              <>
                <GoogleButton from={from} />

                <AuthDivider />
              </>
            )}

            <form onSubmit={submitPassword} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" placeholder="you@example.com" autoComplete="email" autoFocus aria-invalid={!!error} />
              </div>
              {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" aria-invalid={!!error} />
            </div>
            <Button type="submit" disabled={pending !== null} className="play-key h-14 w-full rounded-2xl bg-brand text-base font-extrabold text-white hover:bg-brand">
              {pending === "password" ? t("loadingLogin") : t("passwordSubmit")}
            </Button>
            {!magicUnavailable && (
              <Button type="button" variant="outline" disabled={pending !== null} onClick={submitMagicLink} className="h-12 w-full rounded-2xl font-bold">
                {pending === "magic" ? t("magicSending") : t("magicSubmit")}
              </Button>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {t("noAccount")} <Link href={searchParams.has("from") ? `/${locale}/auth/register?from=${encodeURIComponent(from)}` : `/${locale}/auth/register`} className="play-focus font-semibold text-brand underline-offset-4 hover:underline">{t("register")}</Link>
            </p>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
