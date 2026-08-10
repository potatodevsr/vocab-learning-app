"use client";

import { useMemo, useState } from "react";
import { Pencil, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LetterPicker } from "@/components/admin/letter-picker";
import type { AdminThaiLetter } from "@/lib/admin-api";
import {
  breakDownThai,
  resolveBreakdown,
  serializeBreakdown,
  type ThaiBreakdownPart,
} from "@/lib/thai-letters";

/**
 * What the learner will see under this word, and the way to correct it when it is wrong.
 *
 * The split is derived from `meaningTh` and normally right, which is why it stays derived:
 * a derivation cannot silently drop a letter, and the first hand-written breakdown in this
 * project's history lost `น หนู` from `วัฒนธรรม`. What it cannot do is know where a syllable
 * ends — Thai does not write that boundary — so `แนะ` could read as `น` + `แ‑ะ` (right) or
 * as three loose marks (wrong), and no rule gets every word.
 *
 * Editing is therefore per unit, not free text: a curator selects the characters that belong
 * together and then *names* them from the letter chart. Naming is the point. An earlier
 * version merged the selection and inferred the name from the last unit — `แ` + `ะ` becoming
 * สระแอะ — which was a guess wearing the costume of a rule, and the guess is what the curator
 * opened this control to overrule. Every unit still has to name a real row in the table, so
 * the escape hatch cannot become a second way to lose a character.
 *
 * "คืนค่าอัตโนมัติ" clears the override rather than storing the derived split. A stored copy
 * would freeze today's derivation — improve the algorithm later and every word that was
 * merely *confirmed* would keep the old answer forever.
 */
export function LetterBreakdownEditor({
  meaningTh,
  letters,
  value,
  onChange,
  disabled,
}: {
  meaningTh: string;
  letters: AdminThaiLetter[];
  /** The stored override; empty means derived. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const parts = useMemo(
    () => resolveBreakdown(meaningTh, letters, value),
    [meaningTh, letters, value],
  );
  const derived = useMemo(
    () => breakDownThai(meaningTh, letters),
    [meaningTh, letters],
  );

  const overridden = value.trim() !== "";
  const unknown = parts.filter((part) => !part.known).length;

  if (parts.length === 0) return null;

  const commit = (next: ThaiBreakdownPart[]) => {
    onChange(serializeBreakdown(next));
    setSelected([]);
  };

  const order = [...selected].sort((a, b) => a - b);

  /**
   * Replace the selected units with one the curator has named.
   *
   * The text keeps the characters as written — `แ` + `ะ` stays `แ‑ะ` if the chosen letter is
   * a wrapping vowel — so the tile still shows what is on the page, while the label under it
   * now says what it is. One unit selected is a rename; several is a merge. Same action.
   */
  const applyLetter = (letter: AdminThaiLetter) => {
    if (order.length === 0) return;

    const first = order[0];
    const chars = order.map((index) => parts[index].char).join("");
    const slot = letter.char.indexOf("อ");
    const wrapping = letter.kind === "vowelSound" && slot > -1 && slot < letter.char.length - 1;

    commit([
      ...parts.slice(0, first).filter((_, i) => !order.includes(i)),
      {
        char: wrapping
            ? `${letter.char.slice(0, slot)}‑${letter.char.slice(slot + 1)}`
            : chars,
        letter,
        known: true,
      },
      ...parts.filter((_, i) => i > first && !order.includes(i)),
    ]);
    setPicking(false);
  };

  return (
    <div
      className="mt-2 rounded-md border bg-muted/40 p-3"
      data-testid="thai-breakdown"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          ผู้เรียนจะเห็นเป็นปุ่ม {parts.length} ตัว
        </p>

        {overridden && (
          <span
            data-testid="breakdown-overridden"
            className="rounded bg-accent-sun px-1.5 py-0.5 text-[10px] font-medium text-ink"
          >
            แก้เอง
          </span>
        )}

        <div className="ml-auto flex gap-1">
          {editing ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="breakdown-pick"
                onClick={() => setPicking(true)}
                disabled={disabled || selected.length === 0}
              >
                เลือกตัวอักษร
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setSelected([]);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="breakdown-edit"
              onClick={() => setEditing(true)}
              disabled={disabled}
            >
              <Pencil className="mr-1 h-3 w-3" />
              แก้การแยกเอง
            </Button>
          )}

          {overridden && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-testid="breakdown-reset"
              onClick={() => {
                onChange("");
                setSelected([]);
              }}
              disabled={disabled}
              title={`อัตโนมัติจะแยกเป็น ${derived.length} หน่วย`}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              คืนค่าอัตโนมัติ
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          แตะหน่วยที่ควรเป็นตัวเดียวกัน แล้วกด &quot;เลือกตัวอักษร&quot;
          เพื่อเลือกจากตารางสระ — เช่น แ กับ ะ ใน แนะ คือ สระแอะ (แ–ะ) ตัวเดียว
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {parts.map((part, i) => {
          const picked = selected.includes(i);

          return (
            <button
              key={`${part.char}-${i}`}
              type="button"
              data-testid="thai-letter"
              disabled={!editing || disabled}
              aria-pressed={picked}
              title={
                part.known
                  ? `${part.letter.name} · ${part.letter.roman}`
                  : "ไม่อยู่ในตารางอักษรไทย"
              }
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(i)
                    ? prev.filter((index) => index !== i)
                    : [...prev, i],
                )
              }
              className={`flex min-w-9 flex-col items-center rounded-md border px-2 py-1 ${
                editing ? "cursor-pointer" : "cursor-default"
              } ${
                picked
                  ? "border-ink bg-accent-sun"
                  : part.known
                    ? "border-border bg-background"
                    : "border-destructive bg-destructive/10"
              }`}
            >
              <span className="font-thai text-base leading-none" lang="th">
                {part.char}
              </span>
              <span
                data-testid="thai-letter-roman"
                className="mt-1 text-[9px] leading-none text-muted-foreground"
              >
                {part.known ? part.letter.roman : "?"}
              </span>
            </button>
          );
        })}
      </div>

      <LetterPicker
        open={picking}
        onOpenChange={setPicking}
        letters={letters}
        preview={order.map((index) => parts[index].char).join("")}
        onPick={applyLetter}
      />

      {unknown > 0 && (
        <p className="mt-2 text-xs text-destructive">
          มี {unknown} ตัวที่ไม่ใช่อักษรไทย — ตรวจความหมายไทยอีกครั้ง
        </p>
      )}
    </div>
  );
}
