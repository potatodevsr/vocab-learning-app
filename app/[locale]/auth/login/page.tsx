"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { userLogin } from "@/lib/user-api";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isFormValid = email.trim() !== "" && password.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await userLogin({ email, password });
      setSuccess(true);
      const redirectTo =
        new URLSearchParams(window.location.search).get("from") || `/${locale}`;
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setLoading(false);
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">เข้าสู่ระบบ</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            เพื่อเริ่มเรียนคำศัพท์ Oxford 3000
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="pt-6">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              autoComplete="off"
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
                  required
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
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={!isFormValid}>
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
