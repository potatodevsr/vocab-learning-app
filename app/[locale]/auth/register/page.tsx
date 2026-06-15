"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
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

const PASSWORD_RULES = [
  {
    label: "ความยาว 8-15 ตัวอักษร",
    test: (p: string) => p.length >= 8 && p.length <= 15,
  },
  { label: "ตัวเลขอย่างน้อย 1 ตัว", test: (p: string) => /\d/.test(p) },
  {
    label: "ตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    label: "ตัวพิมพ์เล็กอย่างน้อย 1 ตัว",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    label: "อักขระพิเศษอย่างน้อย 1 ตัว เช่น !,@,#,$,*,&",
    test: (p: string) => /[!@#$*&]/.test(p),
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const locale = useLocale();
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
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setLoading(false);
    }
  };

  if (loading || success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
          <p className="text-zinc-400 text-sm">
            {success ? "สมัครสำเร็จ กำลังเข้าสู่ระบบ..." : "กำลังสร้างบัญชี..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">สมัครสมาชิก</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            เริ่มเรียนคำศัพท์ Oxford 3000 ฟรี
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="pt-6">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              autoComplete="off"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">ชื่อจริง</Label>
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
                  <Label htmlFor="lastName">นามสกุล</Label>
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
                <Label htmlFor="email">Email</Label>
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
                <Label htmlFor="username">Username</Label>
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
                <Label htmlFor="password">Password</Label>
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
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${
                          rule.passed
                            ? "text-emerald-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span>{rule.passed ? "✓" : "○"}</span>
                        {rule.label}
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

              <Button type="submit" className="w-full" disabled={!isFormValid}>
                ยืนยัน
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                มีบัญชีแล้ว?{" "}
                <Link
                  href={`/${locale}/auth/login`}
                  className="text-primary hover:underline"
                >
                  เข้าสู่ระบบ
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
