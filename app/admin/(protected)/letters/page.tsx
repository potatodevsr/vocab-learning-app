"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  createLetter,
  deleteLetter,
  fetchLetters,
  updateLetter,
  type AdminThaiLetter,
  type ThaiLetterDraft,
  type ThaiLetterKind,
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

/**
 * Curating what a learner who cannot read Thai script is *told* each mark is called.
 *
 * The alphabet itself is not in question here — `data/thai-letters.mjs` seeds all 102 rows
 * through a migration, and this screen exists because the wording is editorial. `สระเอ` is
 * useless to the audience it was written for; `sara e` is the whole point of the table.
 *
 * Add and remove are real operations, not decoration: a course may want a mark this list
 * does not carry (obsolete `ฃ`/`ฅ` are seeded but a curator may prefer them gone from the
 * reference page), and the API allows both per row. What it does not allow is a bulk write —
 * see the router comment in backend/src/index.ts.
 */

const KINDS: { value: ThaiLetterKind; label: string; caption: string }[] = [
  {
    value: "consonant",
    label: "พยัญชนะ",
    caption: "44 ตัว ก–ฮ · ปรากฏใต้ปุ่มตัวอักษรของผู้เรียน",
  },
  {
    value: "vowelSign",
    label: "รูปสระ",
    caption: "เครื่องหมายที่เขียนจริง เช่น เ แ ั ี · ใช้แยกคำทีละตัวอักษร",
  },
  { value: "tone", label: "วรรณยุกต์", caption: "ไม้เอก ไม้โท ไม้ตรี ไม้จัตวา" },
  {
    value: "vowelSound",
    label: "สระ 32 เสียง",
    caption: "เสียงสระตามตำราไทย · ใช้ในหน้าตารางอ้างอิง ไม่ใช้ในปุ่มแยกตัวอักษร",
  },
];

const KIND_LABEL = new Map(KINDS.map((k) => [k.value, k.label]));

type FieldSpec = {
  key: keyof ThaiLetterDraft;
  label: string;
  hint: string;
  /** Only meaningful for some kinds — shown for those, hidden for the rest. */
  kinds?: ThaiLetterKind[];
};

/**
 * `roman` and `sound` are two different things and the form says so out loud, because
 * conflating them is the mistake this data invites. `roman` is the romanised *name* a
 * button shows (`sara i` vs `sara ii`); `sound` is strict RTGS, which drops vowel length
 * and writes `i` for both. A curator who types the RTGS value into `roman` makes สระอิ and
 * สระอี indistinguishable to the learner who needed the distinction most.
 */
const FIELDS: FieldSpec[] = [
  { key: "char", label: "ตัวอักษร", hint: "เ" },
  { key: "name", label: "ชื่อภาษาไทย", hint: "สระเอ" },
  {
    key: "roman",
    label: "คำถอดอักษรโรมัน — ชื่อที่ผู้เรียนเห็นใต้ปุ่ม",
    hint: "sara e",
  },
  {
    key: "sound",
    label: "เสียง RTGS (ต้นพยางค์ / เสียงสระ)",
    hint: "k",
    kinds: ["consonant", "vowelSound"],
  },
  {
    key: "soundFinal",
    label: "เสียง RTGS (ตัวสะกด)",
    hint: "k — เว้นว่างถ้าสะกดไม่ได้",
    kinds: ["consonant"],
  },
  { key: "clip", label: "ไฟล์เสียง (audio key)", hint: "sara-e" },
];

const emptyDraft = (kind: ThaiLetterKind, ordinal: number): ThaiLetterDraft => ({
  kind,
  ordinal,
  char: "",
  name: "",
  roman: "",
  sound: "",
  soundFinal: "",
  vowelLength: "",
  clip: "",
});

const fieldsFor = (kind: ThaiLetterKind) =>
  FIELDS.filter((field) => !field.kinds || field.kinds.includes(kind));

export default function AdminLettersPage() {
  const [letters, setLetters] = useState<AdminThaiLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<ThaiLetterKind>("consonant");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ThaiLetterDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLetters(await fetchLetters());
      setError("");
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The request synchronizes this page with the remote letter table.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return letters
      .filter((letter) => letter.kind === kind)
      .filter(
        (letter) =>
          query === "" ||
          letter.char.includes(query) ||
          letter.name.toLowerCase().includes(query) ||
          letter.roman.toLowerCase().includes(query),
      )
      .sort((a, b) => a.ordinal - b.ordinal);
  }, [letters, kind, search]);

  const selected = useMemo(
    () => letters.find((letter) => letter.id === selectedId) ?? null,
    [letters, selectedId],
  );

  const select = (letter: AdminThaiLetter) => {
    setSelectedId(letter.id);
    // `id` is server-assigned and not part of the writable draft.
    setDraft({
      kind: letter.kind,
      ordinal: letter.ordinal,
      char: letter.char,
      name: letter.name,
      roman: letter.roman,
      sound: letter.sound,
      soundFinal: letter.soundFinal,
      vowelLength: letter.vowelLength,
      clip: letter.clip,
    });
    setCreating(false);
    setSaveError("");
    setConfirmDelete(false);
  };

  const startCreate = () => {
    const nextOrdinal =
      Math.max(0, ...letters.filter((l) => l.kind === kind).map((l) => l.ordinal)) + 1;

    setSelectedId(null);
    setDraft(emptyDraft(kind, nextOrdinal));
    setCreating(true);
    setSaveError("");
    setConfirmDelete(false);
  };

  const cancel = () => {
    setSelectedId(null);
    setDraft(null);
    setCreating(false);
    setSaveError("");
    setConfirmDelete(false);
  };

  const dirty = useMemo(() => {
    if (!draft) return false;
    if (creating) return draft.char.trim() !== "" || draft.name.trim() !== "";
    if (!selected) return false;

    return (Object.keys(draft) as (keyof ThaiLetterDraft)[]).some(
      (key) => draft[key] !== selected[key],
    );
  }, [draft, selected, creating]);

  const save = useCallback(async () => {
    if (!draft || !dirty) return;

    setSaving(true);
    setSaveError("");
    try {
      if (creating) {
        const created = await createLetter(draft);
        setLetters((prev) => [...prev, created]);
        select(created);
      } else if (selected) {
        // Only what changed. Sending the whole form back would rewrite a field a second
        // curator edited between this page load and now.
        const changed: Partial<ThaiLetterDraft> = {};
        for (const key of Object.keys(draft) as (keyof ThaiLetterDraft)[]) {
          if (draft[key] !== selected[key]) {
            Object.assign(changed, { [key]: draft[key] });
          }
        }

        const updated = await updateLetter(selected.id, changed);
        setLetters((prev) =>
          prev.map((letter) => (letter.id === updated.id ? updated : letter)),
        );
        select(updated);
      }
    } catch {
      setSaveError(creating ? "เพิ่มไม่สำเร็จ" : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [draft, dirty, creating, selected]);

  const remove = useCallback(async () => {
    if (!selected) return;

    setSaving(true);
    setSaveError("");
    try {
      await deleteLetter(selected.id);
      setLetters((prev) => prev.filter((letter) => letter.id !== selected.id));
      cancel();
    } catch {
      setSaveError("ลบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [selected]);

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

  const activeKind = KINDS.find((k) => k.value === kind);
  const formFields = draft ? fieldsFor(draft.kind) : [];

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background px-4 py-4 sm:px-6">
        <h1 className="font-semibold text-foreground">
          ตัวอักษรไทย — คำถอดอักษรโรมัน (RTGS)
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          ชื่อที่ผู้เรียนต่างชาติเห็นใต้ปุ่มตัวอักษร · เลือกหมวด · เพิ่ม แก้ไข
          หรือลบได้ · กด ⌘S หรือ Ctrl+S เพื่อบันทึก
        </p>
      </header>

      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((entry) => (
            <Button
              key={entry.value}
              type="button"
              size="sm"
              data-testid={`letter-kind-${entry.value}`}
              variant={entry.value === kind ? "default" : "outline"}
              onClick={() => {
                setKind(entry.value);
                cancel();
              }}
            >
              {entry.label}
            </Button>
          ))}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="ml-auto"
            data-testid="letter-add"
            onClick={startCreate}
          >
            <Plus className="mr-1 h-4 w-4" />
            เพิ่มตัวอักษร
          </Button>
        </div>

        {activeKind && (
          <p className="mt-2 text-xs text-muted-foreground">
            {activeKind.caption}
          </p>
        )}

        <div className="mt-4 lg:grid lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-start lg:gap-6">
          {/* ------------------------------------------------------------ list */}
          <section className="rounded-lg border bg-background">
            <div className="border-b p-3">
              <Input
                placeholder="ค้นหาตัวอักษร ชื่อ หรือคำถอด..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9"
              />
            </div>

            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <ul data-testid="letter-list" className="divide-y">
                {visible.map((letter) => (
                  <li key={letter.id}>
                    <button
                      type="button"
                      data-testid="letter-item"
                      onClick={() => select(letter)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${
                        letter.id === selectedId ? "bg-muted" : ""
                      }`}
                    >
                      <span
                        className="font-thai w-10 shrink-0 text-center text-lg"
                        lang="th"
                      >
                        {letter.char}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          data-testid="letter-roman"
                          className="block truncate text-sm font-medium text-foreground"
                        >
                          {letter.roman || "—"}
                        </span>
                        <span className="font-thai block truncate text-xs text-muted-foreground">
                          {letter.name}
                        </span>
                      </span>

                      {letter.sound && (
                        <Badge variant="secondary" className="shrink-0">
                          {letter.sound}
                          {letter.soundFinal ? ` · ${letter.soundFinal}` : ""}
                        </Badge>
                      )}

                      {letter.vowelLength && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {letter.vowelLength === "short" ? "สั้น" : "ยาว"}
                        </span>
                      )}
                    </button>
                  </li>
                ))}

                {visible.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    ไม่พบตัวอักษรในหมวดนี้
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------------------ form */}
          <section className="mt-4 lg:mt-0 lg:sticky lg:top-4">
            {!draft ? (
              <div className="rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground">
                เลือกตัวอักษรจากรายการ หรือกด &quot;เพิ่มตัวอักษร&quot;
              </div>
            ) : (
              <div
                className="rounded-lg border bg-background p-4 sm:p-5"
                data-testid="letter-form"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {creating
                      ? `เพิ่ม${KIND_LABEL.get(draft.kind) ?? ""}`
                      : `แก้ไข ${draft.char}`}
                  </h2>
                  <Badge variant="secondary" className="ml-auto">
                    {KIND_LABEL.get(draft.kind)}
                  </Badge>
                </div>

                <div className="mt-4 space-y-4">
                  {formFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={field.key} className="text-xs">
                        {field.label}
                      </Label>
                      <Input
                        id={field.key}
                        data-testid={`letter-input-${field.key}`}
                        placeholder={field.hint}
                        value={String(draft[field.key] ?? "")}
                        onChange={(event) =>
                          setDraft({ ...draft, [field.key]: event.target.value })
                        }
                        disabled={saving}
                        lang={field.key === "char" || field.key === "name" ? "th" : undefined}
                        className={
                          field.key === "char" || field.key === "name"
                            ? "font-thai"
                            : undefined
                        }
                      />
                    </div>
                  ))}

                  {draft.kind === "vowelSound" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="vowelLength" className="text-xs">
                        ความสั้น-ยาวของสระ
                      </Label>
                      <Select
                        value={draft.vowelLength || "short"}
                        onValueChange={(value) =>
                          setDraft({ ...draft, vowelLength: value })
                        }
                      >
                        <SelectTrigger
                          id="vowelLength"
                          className="w-40"
                          data-testid="letter-input-vowelLength"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">สระเสียงสั้น</SelectItem>
                          <SelectItem value="long">สระเสียงยาว</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="ordinal" className="text-xs">
                      ลำดับในหมวด
                    </Label>
                    <Input
                      id="ordinal"
                      type="number"
                      data-testid="letter-input-ordinal"
                      value={draft.ordinal}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          ordinal: Number(event.target.value) || 0,
                        })
                      }
                      disabled={saving}
                      className="w-28"
                    />
                  </div>
                </div>

                {saveError && (
                  <p className="mt-4 text-sm text-destructive">{saveError}</p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button
                    onClick={save}
                    disabled={!dirty || saving}
                    data-testid="letter-save"
                  >
                    {saving ? "กำลังบันทึก..." : creating ? "เพิ่ม" : "บันทึก"}
                  </Button>

                  <Button variant="ghost" onClick={cancel} disabled={saving}>
                    ยกเลิก
                  </Button>

                  {/*
                    Two taps to delete, and the second one says what will be lost. A letter
                    is referenced by character rather than by id, so removing one does not
                    error anywhere — the mark simply stops being named under every word that
                    contains it, which is not a thing to discover later.
                  */}
                  {!creating && selected && (
                    <div className="ml-auto flex items-center gap-2">
                      {confirmDelete ? (
                        <>
                          <span className="text-xs text-destructive">
                            ลบ {selected.char} ถาวร?
                          </span>
                          <Button
                            variant="destructive"
                            size="sm"
                            data-testid="letter-delete-confirm"
                            onClick={remove}
                            disabled={saving}
                          >
                            ยืนยันลบ
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(false)}
                            disabled={saving}
                          >
                            ไม่ลบ
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="letter-delete"
                          onClick={() => setConfirmDelete(true)}
                          disabled={saving}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          ลบ
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
