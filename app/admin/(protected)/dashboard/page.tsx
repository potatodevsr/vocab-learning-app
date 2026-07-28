import Link from "next/link";
import { ArrowRight, BookOpen, Users } from "lucide-react";

/**
 * Real statistics are still open work (SPEC §7, P6), and inventing them here would be
 * worse than not having them. So this is the drawn empty state the craft bar asks for
 * (§6.1 #5) rather than a page that apologises: it says what is not here yet, and sends
 * you to the two screens that do work.
 */
const SHORTCUTS = [
  {
    href: "/admin/vocabulary",
    label: "คำศัพท์",
    description: "แก้ไขความหมาย คำอ่าน และสถานะการเผยแพร่",
    icon: BookOpen,
  },
  {
    href: "/admin/users",
    label: "ผู้ใช้",
    description: "ดูบัญชีผู้เรียนทั้งหมด",
    icon: Users,
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h2 className="text-xl font-semibold">ภาพรวม</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        สถิติการเรียนกำลังจะมา — ระหว่างนี้เริ่มจากงานที่ทำได้เลย
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
    </div>
  );
}
