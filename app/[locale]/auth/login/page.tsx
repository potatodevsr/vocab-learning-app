"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import Swal from "sweetalert2";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { userLogin } from "@/lib/user-api";
import Link from "next/link";

const isValidEmail = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const showWarning = async (title: string, text: string, confirm: string) => {
  await Swal.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText: confirm,
    confirmButtonColor: "#3f3f46",
    background: "#ffffff",
    color: "#18181b",
    customClass: {
      popup: "app-swal-popup",
      title: "app-swal-title",
      htmlContainer: "app-swal-text",
      confirmButton: "app-swal-confirm",
    },
  });
};

const showError = async (title: string, text: string, confirm: string) => {
  await Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: confirm,
    confirmButtonColor: "#3f3f46",
    background: "#ffffff",
    color: "#18181b",
    customClass: {
      popup: "app-swal-popup",
      title: "app-swal-title",
      htmlContainer: "app-swal-text",
      confirmButton: "app-swal-confirm",
    },
  });
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = async () => {
    if (!email.trim()) {
      await showWarning(
        t("validation.emailRequiredTitle"),
        t("validation.emailRequiredText"),
        t("confirm"),
      );
      return false;
    }

    if (!isValidEmail(email)) {
      await showWarning(
        t("validation.emailInvalidTitle"),
        t("validation.emailInvalidText"),
        t("confirm"),
      );
      return false;
    }

    if (!password.trim()) {
      await showWarning(
        t("validation.passwordRequiredTitle"),
        t("validation.passwordRequiredText"),
        t("confirm"),
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const valid = await validateForm();

    if (!valid) {
      return;
    }

    setLoading(true);

    try {
      await userLogin({
        email: email.trim(),
        password,
      });

      setSuccess(true);

      const redirectTo =
        new URLSearchParams(window.location.search).get("from") || `/${locale}`;

      router.push(redirectTo);
    } catch (err) {
      setLoading(false);
      await showError(
        t("error.loginFailed"),
        getErrorMessage(err, t("error.generic")),
        t("confirm"),
      );
    }
  };

  if (loading || success) {
    return (
      <LoadingOverlay
        message={success ? t("loadingLogin") : t("loadingChecking")}
      />
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
          <h1 className="text-3xl font-bold text-white">{t("loginTitle")}</h1>
          <p className="mt-2 text-sm text-white">{t("loginSubtitle")}</p>
        </div>

        <Card className="play-card rounded-[28px] border-0">
          <CardContent className="pt-6">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              autoComplete="off"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="play-press h-12 w-full rounded-full bg-brand text-base font-semibold text-white hover:bg-brand">
                {t("submit")}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t("noAccount")}{" "}
                <Link
                  href={`/${locale}/auth/register`}
                  className="play-focus font-semibold text-brand underline-offset-4 hover:underline"
                >
                  {t("register")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
