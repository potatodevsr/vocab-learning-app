"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchWordsPage, updateWord, type VocabWord } from "@/lib/admin-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const LEVELS = ["A1", "A2", "B1", "B2"];
const STATUSES = ["draft", "published"];
const PAGE_SIZE = 50;

const EDITABLE_FIELDS = [
  "meaningTh",
  "pronunciationTh",
  "ipa",
  "exampleEn",
  "exampleTh",
  "notes",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

const FIELD_LABELS: Record<EditableField, string> = {
  meaningTh: "ความหมายไทย",
  pronunciationTh: "คำอ่านไทย",
  ipa: "IPA",
  exampleEn: "ตัวอย่าง EN",
  exampleTh: "ตัวอย่าง TH",
  notes: "หมายเหตุ",
};

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  A2: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  B1: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  B2: "bg-orange-100 text-orange-700 hover:bg-orange-100",
};

type EditState = {
  wordId: string;
  field: EditableField;
  value: string;
} | null;

export default function AdminDashboardPage() {
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
  const [edit, setEdit] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

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
    []
  );

  useEffect(() => {
    load(page, levelFilter, statusFilter, search);
  }, [page, levelFilter, statusFilter, search, load]);

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

  const handleSave = useCallback(async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const updated = await updateWord(edit.wordId, {
        [edit.field]: edit.value,
      });
      setWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setEdit(null);
    } catch {
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [edit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEdit(null);
  };

  const handleStatusChange = async (wordId: string, status: string) => {
    try {
      const updated = await updateWord(wordId, { status });
      setWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch {
      alert("บันทึกไม่สำเร็จ");
    }
  };

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/admin/login");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-foreground">
              Oxford 3000 — Translations
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              คลิกที่ช่องเพื่อแก้ไข · กด Enter บันทึก · Esc ยกเลิก
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 py-4 flex gap-3 flex-wrap items-center bg-background border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาคำ..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="pl-8 w-48 h-9"
          />
        </div>

        <Select
          value={levelFilter}
          onValueChange={(v) => handleFilterChange("level", v)}
        >
          <SelectTrigger className="w-36 h-9">
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
          <SelectTrigger className="w-36 h-9">
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

        <span className="text-sm text-muted-foreground ml-auto">
          {total.toLocaleString()} คำ
        </span>
      </div>

      <div className="px-6 py-4">
        <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>คำ</TableHead>
                <TableHead>POS</TableHead>
                <TableHead className="w-16">Level</TableHead>
                {EDITABLE_FIELDS.map((f) => (
                  <TableHead key={f}>{FIELD_LABELS[f]}</TableHead>
                ))}
                <TableHead className="w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({
                        length: 4 + EDITABLE_FIELDS.length + 1,
                      }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : words.map((word, i) => (
                    <TableRow key={word.id}>
                      <TableCell className="text-center text-muted-foreground text-xs">
                        {page * PAGE_SIZE + i + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {word.displayWord}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {word.partOfSpeech}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={LEVEL_COLORS[word.level] ?? ""}
                          variant="secondary"
                        >
                          {word.level}
                        </Badge>
                      </TableCell>
                      {EDITABLE_FIELDS.map((field) => (
                        <TableCell
                          key={field}
                          className="cursor-pointer min-w-[140px] group"
                          onClick={() =>
                            setEdit({
                              wordId: word.id,
                              field,
                              value: word[field],
                            })
                          }
                        >
                          {edit?.wordId === word.id && edit?.field === field ? (
                            <Input
                              autoFocus
                              value={edit.value}
                              onChange={(e) =>
                                setEdit({ ...edit, value: e.target.value })
                              }
                              onBlur={handleSave}
                              onKeyDown={handleKeyDown}
                              disabled={saving}
                              className="h-7 text-xs px-2"
                            />
                          ) : (
                            <span
                              className={`text-xs ${
                                word[field]
                                  ? "text-foreground"
                                  : "text-muted-foreground/40 italic"
                              } group-hover:text-foreground`}
                            >
                              {word[field] || "—"}
                            </span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Select
                          value={word.status}
                          onValueChange={(val) =>
                            handleStatusChange(word.id, val)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            หน้า {page + 1} จาก {totalPages || 1}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1 || loading}
            >
              ถัดไป
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
