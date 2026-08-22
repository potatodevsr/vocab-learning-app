"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronRight, RefreshCw } from "lucide-react";

import { fetchWordsPage, updateWord, type VocabWord } from "@/lib/admin-api";
import { parseReviewFlags, type ReviewFlag } from "@/lib/review";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The Thai review queue.
 *
 * `backend/scripts/flag-thai-quality.mjs` reads all 3,295 rows, names the OCR damage it
 * can recognise, and marks those rows `flagged`. Until a human clears a row it keeps
 * working in the app and stays out of the search index (`lib/review.ts`). This screen is
 * where that human works: one row at a time, the suspicion spelled out, the two fields
 * that matter editable, and one button that means "I read this and it is right".
 *
 * Deliberately not a table. The vocabulary screen at `/admin/vocabulary` is the table —
 * for browsing and bulk curation. A review queue is a different job: it is finished when
 * it is empty, so it shows one item and a count, not fifty rows and a scrollbar.
 *
 * Thai-only, like every other admin screen (AGENTS.md rule 3's documented exception).
 */

const PAGE_SIZE = 50;

/** What each flag means, in the words of someone who has to judge the row. */
const FLAG_LABELS: Record<ReviewFlag, string> = {
  "no-thai": "ไม่มีอักษรไทยเลย",
  "empty-meaning": "เผยแพร่อยู่แต่ไม่มีความหมาย",
  "latin-in-thai": "มีอักษรโรมันปนอยู่ในคำไทย",
  "glyph-spacing": "มีช่องว่างคั่นทีละตัวอักษร",
  "orphan-mark": "มีวรรณยุกต์/สระลอย ไม่มีพยัญชนะรอง",
  "double-mark": "วรรณยุกต์ซ้อนกันสองตัว",
  "dangling-vowel": "ลงท้ายด้วยสระหน้า (เ แ โ ใ ไ)",
  "length-outlier": "ความยาวผิดปกติ",
  "missing-pronunciation": "เผยแพร่อยู่แต่ไม่มีคำอ่าน",
  "meaning-dupe": "ความหมายซ้ำกับคำอื่นหลายคำ",
};

type Draft = { meaningTh: string; pronunciationTh: string };

export default function AdminReviewPage() {
  const [queue, setQueue] = useState<VocabWord[]>([]);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({ meaningTh: "", pronunciationTh: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const current = queue[index] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await fetchWordsPage({
        take: PAGE_SIZE,
        skip: 0,
        reviewState: "flagged",
      });
      setQueue(result.data);
      setTotal(result.total);
      setIndex(0);
    } catch {
      setError("โหลดคิวตรวจทานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetching the queue is the point of the screen; there is nothing to render first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      meaningTh: current?.meaningTh ?? "",
      pronunciationTh: current?.pronunciationTh ?? "",
    });
  }, [current]);

  /**
   * Approve, with whatever edits are in the form.
   *
   * One PUT carries both: the corrected Thai and the verdict. Splitting them would leave a
   * window where the row is approved with the old text in it — which is precisely the
   * state this queue exists to prevent, and it would be indexed.
   */
  const approve = async () => {
    if (!current || saving) return;

    setSaving(true);
    setError("");

    try {
      await updateWord(current.id, {
        meaningTh: draft.meaningTh.trim(),
        pronunciationTh: draft.pronunciationTh.trim(),
        reviewState: "approved",
        reviewFlags: "[]",
        reviewedAt: new Date().toISOString(),
      });

      /**
       * Approving changes whether the page may be indexed, so the cached render has to go.
       * Failure is swallowed for the same reason the vocabulary screen swallows it: the
       * row is already saved, and a stale page for up to an hour is not worth showing an
       * error that reads like the review did not land.
       */
      try {
        await fetch("/admin/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: current.slug,
            level: current.level,
            unit: current.unit,
          }),
        });
      } catch {
        // Ignored on purpose — see above.
      }

      setQueue((rows) => rows.filter((row) => row.id !== current.id));
      setTotal((count) => Math.max(0, count - 1));
      setIndex((position) => Math.min(position, Math.max(0, queue.length - 2)));
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  /** Leaves the row flagged and moves on — "I am not the right person to judge this". */
  const skip = () => setIndex((position) => Math.min(position + 1, queue.length - 1));

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ตรวจทานความหมายไทย</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            คำที่ระบบตรวจพบความผิดปกติ จะไม่ถูกจัดทำดัชนีในเสิร์ชเอนจินจนกว่าจะมีคนยืนยันว่าถูกต้อง
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
      ) : !current ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Check className="mx-auto mb-3 size-8 text-emerald-600" />
          <p className="font-medium">คิวว่างแล้ว</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ไม่มีคำที่รอการตรวจทานในขณะนี้
          </p>
        </div>
      ) : (
        <div className="rounded-lg border p-6" data-testid="review-card">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <div>
              <p className="text-3xl font-bold" data-testid="review-word">
                {current.displayWord}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {current.partOfSpeech} · {current.level}
                {current.unit ? ` · หน่วยที่ ${current.unit}` : ""} · {current.status}
              </p>
            </div>
            <p className="shrink-0 text-sm text-muted-foreground">
              เหลือ <span data-testid="review-remaining">{total}</span> คำ
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {parseReviewFlags(current.reviewFlags).map((flag) => (
              <Badge key={flag} variant="secondary" className="gap-1">
                <AlertTriangle className="size-3" />
                {FLAG_LABELS[flag]}
              </Badge>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="review-meaning">ความหมายไทย</Label>
              <Input
                id="review-meaning"
                value={draft.meaningTh}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, meaningTh: event.target.value }))
                }
                className="mt-1 text-lg"
              />
            </div>
            <div>
              <Label htmlFor="review-pronunciation">คำอ่านศัพท์อังกฤษ (อักษรไทย)</Label>
              <Input
                id="review-pronunciation"
                value={draft.pronunciationTh}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    pronunciationTh: event.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button onClick={approve} disabled={saving} data-testid="review-approve">
              <Check className="mr-2 size-4" />
              {saving ? "กำลังบันทึก…" : "ถูกต้อง เผยแพร่ได้"}
            </Button>
            <Button variant="ghost" onClick={skip} disabled={saving || queue.length < 2}>
              ข้ามไปก่อน
              <ChevronRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
