"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Library, RefreshCw, ShieldCheck, Users } from "lucide-react";

import { API_URL } from "@/constants/config";
import { Button } from "@/components/ui/button";

/**
 * The admin overview, with real numbers (SPEC §7, P6 — this screen was a placeholder).
 *
 * Two halves, because they are two different jobs. **Content readiness** answers "how much
 * of the corpus can a learner actually trust", and every bar on it is a fraction with its
 * denominator visible — a coverage percentage without the total is the number that lets a
 * corpus rot quietly. **Learners** answers "is anyone coming back", and it deliberately
 * shows counts rather than rates: with a handful of accounts, a percentage is noise wearing
 * a suit.
 *
 * Nothing here is stored or aggregated by a job. It is all derived on read
 * (`backend/src/stats.ts`), so it cannot disagree with what a learner sees on their own
 * progress page.
 *
 * Thai-only, like every admin screen.
 */

type Stats = {
  content: {
    words: number;
    published: number;
    withMeaning: number;
    withExample: number;
    withAudio: number;
    flagged: number;
    approved: number;
    unreviewed: number;
    publishedLists: number;
  };
  learners: {
    total: number;
    newThisMonth: number;
    activated: number;
    activeThisWeek: number;
    returningThisWeek: number;
    reminderOptIns: number;
    pushSubscriptions: number;
  };
  sessions: { completed: number; thisWeek: number };
};

const SHORTCUTS = [
  {
    href: "/admin/vocabulary",
    label: "คำศัพท์",
    description: "แก้ไขความหมาย คำอ่าน และสถานะการเผยแพร่",
    icon: BookOpen,
  },
  {
    href: "/admin/review",
    label: "ตรวจทานความหมาย",
    description: "คำที่ระบบตรวจพบความผิดปกติ รอคนยืนยัน",
    icon: ShieldCheck,
  },
  {
    href: "/admin/lists",
    label: "คลังคำศัพท์",
    description: "เปิดหรือปิดคลังคำให้ผู้เรียนเห็น",
    icon: Library,
  },
  {
    href: "/admin/users",
    label: "ผู้ใช้",
    description: "ดูบัญชีผู้เรียนทั้งหมด",
    icon: Users,
  },
];

/** A count over a total, with the bar that makes the gap obvious at a glance. */
function Coverage({
  label,
  value,
  total,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  hint?: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div data-testid={`stat-${label}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {value.toLocaleString("th-TH")} / {total.toLocaleString("th-TH")} ({percent}%)
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString("th-TH")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/admin/stats`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error();

      setStats((await res.json()) as Stats);
    } catch {
      setError("โหลดสถิติไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">ภาพรวม</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ตัวเลขทั้งหมดคำนวณสดจากฐานข้อมูล ไม่มีตารางสรุปที่ค้างเก่า
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 size-4" />
          โหลดใหม่
        </Button>
      </header>

      {error ? (
        <p className="mt-6 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {stats ? (
        <>
          <section className="mt-8" data-testid="admin-content-stats">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              ความพร้อมของเนื้อหา
            </h3>

            <div className="mt-4 space-y-4">
              <Coverage
                label="เผยแพร่แล้ว"
                value={stats.content.published}
                total={stats.content.words}
              />
              <Coverage
                label="มีความหมายไทย"
                value={stats.content.withMeaning}
                total={stats.content.published}
              />
              <Coverage
                label="มีประโยคตัวอย่าง"
                value={stats.content.withExample}
                total={stats.content.published}
                hint="ข้อเติมคำในช่องว่างจะข้ามคำที่ยังไม่มีตัวอย่าง"
              />
              <Coverage
                label="มีไฟล์เสียง"
                value={stats.content.withAudio}
                total={stats.content.published}
                hint="ข้อฟังเสียงจะข้ามคำที่ยังไม่มีไฟล์เสียง"
              />
              <Coverage
                label="ผ่านการตรวจทานโดยคน"
                value={stats.content.approved}
                total={stats.content.words}
                hint="คำที่ระบบสงสัยจะไม่ถูกจัดทำดัชนีจนกว่าจะมีคนยืนยัน"
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Figure label="รอตรวจทาน (ระบบสงสัย)" value={stats.content.flagged} />
              <Figure label="ยังไม่มีใครอ่าน" value={stats.content.unreviewed} />
              <Figure label="คลังคำที่เปิดใช้" value={stats.content.publishedLists} />
            </div>
          </section>

          <section className="mt-10" data-testid="admin-learner-stats">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              ผู้เรียน
            </h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Figure label="บัญชีทั้งหมด" value={stats.learners.total} />
              <Figure label="สมัครใน 30 วัน" value={stats.learners.newThisMonth} />
              <Figure
                label="เริ่มเรียนจริง"
                value={stats.learners.activated}
                hint="เรียนจบอย่างน้อย 1 บทเรียน"
              />
              <Figure label="ใช้งานสัปดาห์นี้" value={stats.learners.activeThisWeek} />
              <Figure
                label="กลับมาเรียนซ้ำ"
                value={stats.learners.returningThisWeek}
                hint="เคยเรียนก่อนสัปดาห์นี้ และกลับมาอีก"
              />
              <Figure label="บทเรียนที่เรียนจบ" value={stats.sessions.completed} />
              <Figure label="เปิดอีเมลเตือน" value={stats.learners.reminderOptIns} />
              <Figure label="เปิดแจ้งเตือนบนเครื่อง" value={stats.learners.pushSubscriptions} />
              <Figure label="บทเรียนสัปดาห์นี้" value={stats.sessions.thisWeek} />
            </div>
          </section>
        </>
      ) : loading ? (
        <p className="mt-8 text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : null}

      <section className="mt-10">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          ทางลัด
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="play-focus group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand hover:bg-brand-soft"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
                <shortcut.icon className="size-5" />
              </span>

              <span className="min-w-0">
                <span className="flex items-center gap-1 font-semibold">
                  {shortcut.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {shortcut.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
