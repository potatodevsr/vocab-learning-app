"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMagicLink } from "@/lib/user-api";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function LoginPage() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError(t("validation.emailInvalidText"));
      return;
    }

    setPending(true);
    try {
      const from = new URLSearchParams(window.location.search).get("from") ?? undefined;
      const result = await requestMagicLink({ email: email.trim(), locale, from });
      setDevMagicLink(result.devMagicLink ?? null);
      setSent(true);
    } catch {
      setError(t("error.generic"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand px-4">
      <div className="w-full max-w-md">
        <Link href={`/${locale}`} className="play-underline play-focus mb-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
          <ArrowLeft className="size-4" />
          {t("backHome")}
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">{t("magicTitle")}</h1>
          <p className="mt-2 text-sm text-white">{t("magicSubtitle")}</p>
        </div>

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
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" placeholder="you@example.com" autoComplete="email" autoFocus aria-invalid={!!error} />
                  </div>
                  {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
                </div>
                <Button type="submit" disabled={pending} className="play-key h-14 w-full rounded-2xl bg-brand text-base font-extrabold text-white hover:bg-brand">
                  {pending ? t("magicSending") : t("magicSubmit")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t("noAccount")} <Link href={`/${locale}/auth/register`} className="play-focus font-semibold text-brand underline-offset-4 hover:underline">{t("register")}</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
