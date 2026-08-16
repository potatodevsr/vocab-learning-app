"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchLetters,
  fetchWordsPage,
  updateWord,
  type AdminThaiLetter,
  type VocabWord,
} from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LogOut,
  Search,
} from "lucide-react";
import { API_URL } from "@/constants/config";
import { LetterBreakdownEditor } from "@/components/admin/letter-breakdown-editor";

const LEVELS = ["A1", "A2", "B1", "B2"];
const STATUSES = ["draft", "published"];
const PAGE_SIZE = 50;

/**
 * The curation form, in the order someone actually fills it in.
 *
 * `pronunciationTh` and `meaningThReading` point in opposite directions and were once
 * both labelled "คำอ่านไทย", which is how they got filled in wrong: pronunciationTh
 * spells the *English* word in Thai (about → เออะ บ๊าว ถึ), while meaningThReading and
 * meaningThRoman read the *Thai meaning* aloud for a foreigner
 * (วัฒนธรรม → วัด-ทะ-นะ-ทำ → Wat-tha-na-tham). Grouping them under separate headings is
 * the other half of keeping them apart.
 */
type EditableField =
  | "meaningTh"
  | "meaningThReading"
  | "meaningThRoman"
  | "pronunciationTh"
  | "exampleEn"
  | "exampleTh";

type FieldSpec = { key: EditableField; label: string; hint: string };
type FieldGroup = { title: string; caption: string; fields: FieldSpec[] };

const GROUPS: FieldGroup[] = [
  {
    title: "ความหมายไทย และคำอ่าน",
    caption: "สำหรับคนต่างชาติที่อยากอ่านภาษาไทย",
    fields: [
      { key: "meaningTh", label: "ความหมายไทย", hint: "วัฒนธรรม" },
      {
        key: "meaningThReading",
        label: "อ่านออกเสียงว่า",
        hint: "วัด-ทะ-นะ-ทำ",
      },
      {
        key: "meaningThRoman",
        label: "คำถอดอักษรไทยเป็นอักษรโรมันตามหลักเกณฑ์ของราชบัณฑิตยสภา",
        hint: "Wat-tha-na-tham",
      },
    ],
  },
  {
    title: "การออกเสียงคำอังกฤษ",
    caption: "สำหรับคนไทยที่กำลังเรียนอังกฤษ",
    fields: [
      {
        key: "pronunciationTh",
        label: "คำอ่านศัพท์อังกฤษ",
        hint: "เออะ บ๊าว ถึ",
      },
    ],
  },
];

const EXAMPLE_GROUP: FieldGroup = {
  title: "ตัวอย่างประโยค",
  caption: "",
  fields: [
    {
      key: "exampleEn",
      label: "ตัวอย่าง EN",
      hint: "",
    },
    {
      key: "exampleTh",
      label: "ตัวอย่าง TH",
      hint: "",
    },
  ],
};

const FIELDS: FieldSpec[] = [...GROUPS, EXAMPLE_GROUP].flatMap(
  (group) => group.fields,
);

/** Every form field counts toward the "done" tally — there are no scratchpad fields. */
const SCORED_FIELDS = FIELDS.map((f) => f.key);

const progressOf = (word: VocabWord): { done: number; total: number } => {
  return {
    done: SCORED_FIELDS.filter((key) => word[key].trim() !== "").length,
    total: SCORED_FIELDS.length,
  };
};

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  A2: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  B1: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  B2: "bg-orange-100 text-orange-700 hover:bg-orange-100",
};

type Draft = Record<EditableField, string> & {
  status: string;
  /** JSON override for the letter breakdown; empty means derive it. */
  letterBreakdown: string;
};

const draftOf = (word: VocabWord): Draft => ({
  ...(Object.fromEntries(FIELDS.map((f) => [f.key, word[f.key]])) as Record<
    EditableField,
    string
  >),
  status: word.status,
  letterBreakdown: word.letterBreakdown,
});

export default function AdminVocabularyPage() {
  const router = useRouter();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  /**
   * The alphabet, for the breakdown preview under `meaningTh`.
   *
   * Fetched once for the whole screen rather than per selected word: it is 70 rows that do
   * not change while the page is open, and re-reading them on every click would be a
   * request per word across a 3,295-row curation session. An empty list simply hides the
   * preview — it is an aid, and losing it must not stop anyone editing a meaning.
   */
  const [letters, setLetters] = useState<AdminThaiLetter[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const load = useCallback(
    async (p: number, level: string, status: string, q: string) => {
      setLoading(true);
      try {
        const result = await fetchWordsPage({
          take: PAGE_SIZE,
          skip: p * PAGE_SIZE,
          level: level !== "all" ? level : undefined,
          status: status !== "all" ? status : undefined,
          search: q || undefined,
        });
        setWords(result.data);
        setTotal(result.total);
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // The request synchronizes this page with the remote vocabulary data source.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page, levelFilter, statusFilter, search);
  }, [page, levelFilter, statusFilter, search, load]);

  useEffect(() => {
    let cancelled = false;

    fetchLetters()
      .then((all) => {
        if (cancelled) return;
        // The three kinds a per-character breakdown can name. `vowelSound` is excluded:
        // those are sounds, and several are written across characters that already have
        // their own rows — including them would make `char` ambiguous.
        setLetters(
          all.filter((letter) => letter.kind !== "vowelSound"),
        );
      })
      .catch(() => {
        if (!cancelled) setLetters([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => words.find((w) => w.id === selectedId) ?? null,
    [words, selectedId],
  );

  const selectWord = useCallback((word: VocabWord) => {
    setSelectedId(word.id);
    setDraft(draftOf(word));
    setSaveError("");
  }, []);

  const dirty = useMemo(() => {
    if (!selected || !draft) return false;

    return (
      draft.status !== selected.status ||
      draft.letterBreakdown !== selected.letterBreakdown ||
      FIELDS.some((f) => draft[f.key] !== selected[f.key])
    );
  }, [selected, draft]);

  const save = useCallback(async () => {
    if (!selected || !draft || !dirty) return;

    // Only what actually changed. Sending the whole form back would rewrite fields a
    // second curator edited between this page load and now.
    const changed: Record<string, string> = {};
    for (const field of FIELDS) {
      if (draft[field.key] !== selected[field.key]) {
        changed[field.key] = draft[field.key];
      }
    }
    if (draft.status !== selected.status) changed.status = draft.status;
    if (draft.letterBreakdown !== selected.letterBreakdown) {
      changed.letterBreakdown = draft.letterBreakdown;
    }

    const sharedUsageChanged = (["meaningTh", "exampleEn", "exampleTh"] as const)
      .some((key) => draft[key] !== selected[key]);
    if (sharedUsageChanged && selected.posUsages !== "[]") {
      // Older rows may still carry per-part-of-speech content. Once an editor chooses the
      // new single meaning/example set, remove that legacy override so learner pages use
      // exactly what was just saved instead of continuing to show the old split blocks.
      changed.posUsages = "[]";
    }

    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateWord(selected.id, changed);
      setWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setDraft(draftOf(updated));

      /**
       * Drop the cached renders this edit invalidates, and wait for it.
       *
       * The learner-facing pages are incrementally regenerated on an hourly window, so
       * without this an editor fixes a meaning and then watches the old one sit there —
       * which reads as "the save silently failed" and is how someone ends up saving
       * twice. Awaited rather than fired and forgotten so that "saved" means the reader
       * would see it; otherwise navigating away immediately can cancel the request and
       * leave the stale copy in place.
       *
       * Its own try/catch: the write already succeeded, and a cache purge that fails is
       * not a save that failed. Worst case the page is stale until `revalidate` expires.
       */
      try {
        await fetch("/admin/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: updated.slug,
            level: updated.level,
            unit: updated.unit,
          }),
        });
      } catch {
        // Stale-until-expiry is an acceptable degradation; a false error is not.
      }
    } catch {
      setSaveError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [selected, draft, dirty]);

  /**
   * Step through the list. Saving first is deliberate: this screen exists to walk 3,752
   * rows in order, and losing an entry because you reached for "ถัดไป" instead of
   * "บันทึก" would be the single most annoying thing it could do.
   */
  const step = useCallback(
    async (delta: number) => {
      if (!selected) return;

      const index = words.findIndex((w) => w.id === selected.id);
      const next = words[index + delta];
      if (!next) return;

      if (dirty) await save();
      selectWord(next);
    },
    [selected, words, dirty, save, selectWord],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const handleFilterChange = (type: "level" | "status", val: string) => {
    setPage(0);
    if (type === "level") setLevelFilter(val);
    else setStatusFilter(val);
  };

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      setSearch(val);
    }, 400);
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/admin/login");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const index = selected ? words.findIndex((w) => w.id === selected.id) : -1;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-foreground">
              Oxford 3000 — Translations
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              เลือกคำจากรายการ · แก้ในฟอร์มด้านขวา · กด ⌘S หรือ Ctrl+S
              เพื่อบันทึก
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
            ออกจากระบบ
          </Button>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(260px,340px)_1fr] lg:items-start">
        {/* ---------------------------------------------------------- list */}
        <aside
          className={`border-b bg-background lg:sticky lg:top-[61px] lg:h-[calc(100vh-61px)] lg:overflow-y-auto lg:border-r lg:border-b-0 ${
            selected ? "hidden lg:block" : "block"
          }`}
        >
          <div className="space-y-3 border-b p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาคำ..."
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="h-9 pl-8"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={levelFilter}
                onValueChange={(v) => handleFilterChange("level", v)}
              >
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue placeholder="ทุก Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก Level</SelectItem>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(v) => handleFilterChange("status", v)}
              >
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue placeholder="ทุก Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก Status</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              {total.toLocaleString()} คำ · หน้า {page + 1} จาก{" "}
              {totalPages || 1}
            </p>
          </div>

          <ul data-testid="word-list">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <li key={i} className="border-b px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </li>
                ))
              : words.map((word) => {
                  const progress = progressOf(word);
                  const isSelected = word.id === selectedId;

                  return (
                    <li key={word.id}>
                      <button
                        type="button"
                        data-testid="word-item"
                        onClick={() => selectWord(word)}
                        className={`flex w-full cursor-pointer items-center gap-3 border-b px-4 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none ${
                          isSelected ? "bg-muted" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            data-testid="word-label"
                            className="block truncate text-sm font-medium text-foreground"
                          >
                            {word.displayWord}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {word.partOfSpeech}
                            {word.meaningTh ? ` · ${word.meaningTh}` : ""}
                          </span>
                        </span>

                        <Badge
                          className={`${LEVEL_COLORS[word.level] ?? ""} shrink-0`}
                          variant="secondary"
                        >
                          {word.level}
                        </Badge>

                        {/* How much of this word is curated, at a glance. */}
                        <span
                          title={`กรอกแล้ว ${progress.done}/${progress.total}`}
                          className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground"
                        >
                          {progress.done}/{progress.total}
                        </span>
                      </button>
                    </li>
                  );
                })}
          </ul>

          <div className="flex items-center justify-between gap-2 p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1 || loading}
            >
              ถัดไป
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </aside>

        {/* -------------------------------------------------------- editor */}
        <section className={selected ? "block" : "hidden lg:block"}>
          {!selected || !draft ? (
            <div className="flex min-h-[50vh] items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">
                เลือกคำจากรายการทางซ้ายเพื่อเริ่มแก้ไข
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl p-4 sm:p-6">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  รายการ
                </Button>

                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {selected.displayWord}
                </h2>

                <Badge
                  className={LEVEL_COLORS[selected.level] ?? ""}
                  variant="secondary"
                >
                  {selected.level}
                </Badge>

                <span className="text-sm text-muted-foreground">
                  {selected.partOfSpeech}
                </span>
              </div>

              <div className="space-y-6">
                {[...GROUPS, EXAMPLE_GROUP].map((group) => (
                  <div
                    key={group.title}
                    className="rounded-lg border bg-background p-4 sm:p-5"
                  >
                    <h3 className="text-sm font-semibold text-foreground">
                      {group.title}
                    </h3>
                    {group.caption && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {group.caption}
                      </p>
                    )}

                    <div className="mt-4 space-y-4">
                      {group.fields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label htmlFor={field.key} className="text-xs">
                            {field.label}
                          </Label>
                          <Input
                            id={field.key}
                            data-testid={`input-${field.key}`}
                            placeholder={field.hint}
                            value={draft[field.key]}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                [field.key]: e.target.value,
                              })
                            }
                            disabled={saving}
                          />

                          {field.key === "meaningTh" && (
                            <LetterBreakdownEditor
                              meaningTh={draft.meaningTh}
                              letters={letters}
                              value={draft.letterBreakdown}
                              onChange={(next) =>
                                setDraft({ ...draft, letterBreakdown: next })
                              }
                              disabled={saving}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rounded-lg border bg-background p-4 sm:p-5">
                  <Label htmlFor="status" className="text-xs">
                    Status
                  </Label>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v })}
                  >
                    <SelectTrigger
                      id="status"
                      className="mt-1.5 w-40"
                      data-testid="input-status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {saveError && (
                <p className="mt-4 text-sm text-destructive">{saveError}</p>
              )}

              {/* Sticky so "บันทึก" is reachable without scrolling back up the form. */}
              <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
                <Button
                  onClick={save}
                  disabled={!dirty || saving}
                  data-testid="save-word"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </Button>

                <span className="text-xs text-muted-foreground">
                  {dirty ? "ยังไม่ได้บันทึก" : "บันทึกสำเร็จ"}
                </span>

                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="prev-word"
                    onClick={() => step(-1)}
                    disabled={index <= 0 || saving}
                  >
                    <ChevronUp className="mr-1 h-4 w-4" />
                    ก่อนหน้า
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="next-word"
                    onClick={() => step(1)}
                    disabled={index < 0 || index >= words.length - 1 || saving}
                  >
                    <ChevronDown className="mr-1 h-4 w-4" />
                    ถัดไป
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
