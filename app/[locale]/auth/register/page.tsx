"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { userRegister, userLogin } from "@/lib/user-api";
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

/** The rule is code; its label is copy, and copy lives in `messages/*.json`. */
const PASSWORD_RULES = [
  { key: "Length", test: (p: string) => p.length >= 8 && p.length <= 15 },
  { key: "Digit", test: (p: string) => /\d/.test(p) },
  { key: "Upper", test: (p: string) => /[A-Z]/.test(p) },
  { key: "Lower", test: (p: string) => /[a-z]/.test(p) },
  { key: "Special", test: (p: string) => /[!@#$*&]/.test(p) },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await userRegister(form);
      await userLogin({ email: form.email, password: form.password });
      setSuccess(true);
      router.push(`/${locale}`);
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
    <div className="flex min-h-screen items-center justify-center bg-brand px-4">
      <div className="w-full max-w-md">
        {/* The app bar is hidden on auth screens, so this is the only way back out. */}
        <Link
          href={`/${locale}`}
          className="play-underline play-focus mb-6 inline-flex items-center gap-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="size-4" />
          {t("backHome")}
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t("registerTitle")}</h1>
          <p className="mt-2 text-sm text-white">{t("registerSubtitle")}</p>
        </div>

        <Card className="play-card rounded-[28px] border-0">
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

              <Button type="submit" className="play-press h-12 w-full rounded-full bg-brand text-base font-semibold text-white hover:bg-brand" disabled={!isFormValid}>
                {t("submit")}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t("haveAccount")}{" "}
                <Link
                  href={`/${locale}/auth/login`}
                  className="play-focus font-semibold text-brand underline-offset-4 hover:underline"
                >
                  {t("signIn")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
