"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
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

const showWarning = async (title: string, text: string) => {
  await Swal.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText: "ตกลง",
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

const showError = async (title: string, text: string) => {
  await Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "ตกลง",
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

const getErrorMessage = (err: unknown) => {
  return err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
};

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = async () => {
    if (!email.trim()) {
      await showWarning("กรุณากรอกอีเมล", "โปรดระบุอีเมลก่อนเข้าสู่ระบบ");
      return false;
    }

    if (!isValidEmail(email)) {
      await showWarning(
        "อีเมลไม่ถูกต้อง",
        "กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com"
      );
      return false;
    }

    if (!password.trim()) {
      await showWarning("กรุณากรอกรหัสผ่าน", "โปรดระบุรหัสผ่านก่อนเข้าสู่ระบบ");
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
      await showError("เข้าสู่ระบบไม่สำเร็จ", getErrorMessage(err));
    }
  };

  if (loading || success) {
    return (
      <LoadingOverlay
        message={success ? "กำลังเข้าสู่ระบบ..." : "กำลังตรวจสอบข้อมูล..."}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white drop-shadow-sm">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-white/90">
            เพื่อเริ่มเรียนคำศัพท์ Oxford 3000
          </p>
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
                <Label htmlFor="email">Email</Label>
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
                <Label htmlFor="password">Password</Label>
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
                ยืนยัน
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                ยังไม่มีบัญชี?{" "}
                <Link
                  href={`/${locale}/auth/register`}
                  className="text-primary hover:underline"
                >
                  สมัครสมาชิก
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
