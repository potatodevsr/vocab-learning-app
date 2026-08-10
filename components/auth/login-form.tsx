"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMagicLink } from "@/lib/user-api";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

type LoginFormProps = {
  /**
   * The validated return target, already resolved server-side by `safeReturnPath`
   * (`app/[locale]/auth/login/page.tsx`) — never the raw, attacker-controllable query
   * value. `null` when there is none.
   */
  from: string | null;
};

export function LoginForm({ from }: LoginFormProps) {
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
      const result = await requestMagicLink({
        email: email.trim(),
        locale,
        from: from ?? undefined,
      });
      setDevMagicLink(result.devMagicLink ?? null);
      setSent(true);
    } catch {
      setError(t("error.generic"));
    } finally {
      setPending(false);
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
              {t("noAccount")} <Link href={from ? `/${locale}/auth/register?from=${encodeURIComponent(from)}` : `/${locale}/auth/register`} className="play-focus font-semibold text-brand underline-offset-4 hover:underline">{t("register")}</Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
