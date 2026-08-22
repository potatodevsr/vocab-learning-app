"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";

import { API_URL } from "@/constants/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Word lists, and whether learners are offered them.
 *
 * The import (`backend/scripts/import-wordlist.mjs`) deliberately cannot publish anything:
 * it writes the list unpublished and its words as drafts. This screen is where a human
 * ends that — after reading the Thai, not before. The API refuses to publish a list with
 * no published words, so the failure this prevents is the one that matters: a learner
 * choosing a course that renders empty.
 *
 * Thai-only, like every admin screen.
 */

type AdminList = {
  id: string;
  title: string;
  titleTh: string;
  ordinal: number;
  isFree: boolean;
  isPublished: boolean;
  publishedWords: number;
  draftWords: number;
};

export default function AdminListsPage() {
  const [lists, setLists] = useState<AdminList[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/wordlists/admin`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error();

      setLists(((await res.json()) as { lists: AdminList[] }).lists);
    } catch {
      setError("โหลดรายการคลังคำไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const update = async (id: string, patch: Partial<Pick<AdminList, "isPublished" | "isFree">>) => {
    setBusyId(id);
    setError("");

    try {
      const res = await fetch(`${API_URL}/wordlists/admin/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        // 422 is the meaningful one: publishing a list with nothing published in it.
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(
          res.status === 422
            ? "คลังคำนี้ยังไม่มีคำที่เผยแพร่ จึงยังเปิดให้ผู้เรียนไม่ได้"
            : (body.message ?? "บันทึกไม่สำเร็จ"),
        );
        return;
      }

      await load();
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">คลังคำศัพท์</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            คลังที่นำเข้าใหม่จะยังไม่เปิดให้ผู้เรียนเห็น จนกว่าจะตรวจทานและกดเผยแพร่ที่นี่
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 size-4" />
          โหลดใหม่
        </Button>
      </header>

      {error ? (
        <p className="mb-6 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : (
        <ul className="space-y-4" data-testid="admin-lists">
          {lists.map((list) => (
            <li key={list.id} className="rounded-lg border p-5" data-testid="admin-list-row">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">
                    {list.titleTh || list.title}{" "}
                    <span className="text-sm font-normal text-muted-foreground">{list.id}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    เผยแพร่แล้ว {list.publishedWords} คำ · ฉบับร่าง {list.draftWords} คำ
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={list.isPublished ? "default" : "secondary"}>
                    {list.isPublished ? "เปิดให้ผู้เรียน" : "ยังไม่เปิด"}
                  </Badge>
                  {list.isFree ? <Badge variant="outline">ฟรี</Badge> : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={list.isPublished ? "outline" : "default"}
                  disabled={busyId === list.id}
                  data-testid={`admin-list-toggle-${list.id}`}
                  onClick={() => update(list.id, { isPublished: !list.isPublished })}
                >
                  {busyId === list.id ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : list.isPublished ? (
                    <EyeOff className="mr-2 size-4" />
                  ) : (
                    <Eye className="mr-2 size-4" />
                  )}
                  {list.isPublished ? "ปิดไม่ให้ผู้เรียนเห็น" : "เผยแพร่ให้ผู้เรียน"}
                </Button>

                {list.publishedWords > 0 && !list.isPublished ? (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Check className="size-4" />
                    พร้อมเผยแพร่
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
