"use client";

import { useMemo, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type { AdminThaiLetter, ThaiLetterKind } from "@/lib/admin-api";

/**
 * `แอะ` is how the row is stored (with `อ` marking the consonant slot); `แ–ะ` is how it is
 * read, and how every Thai classroom chart draws it. Deriving the display from the stored
 * shape keeps `/admin/letters` the single place the inventory is defined — a vowel added
 * there shows up here already drawn. `replace` takes the first `อ` only, which is what
 * makes `อือ` render `–ือ` and `ออ` render `–อ` rather than losing their second one.
 */
const letterDisplay = (letter: AdminThaiLetter) =>
  letter.kind === "vowelSound" && letter.char.includes("อ")
    ? letter.char.replace("อ", "–")
    : letter.char;

/**
 * Declared at module scope, not inside the picker: a component created during render is a
 * new type on every keystroke, so React unmounts and remounts the grid — losing scroll
 * position in a 44-tile list while the curator is searching it.
 */
function LetterGrid({
  items,
  onPick,
}: {
  items: AdminThaiLetter[];
  onPick: (letter: AdminThaiLetter) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        ไม่พบตัวอักษรที่ค้นหา
      </p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {items.map((letter) => {
        const long = letter.vowelLength === "long";

        return (
          <button
            key={letter.id}
            type="button"
            data-testid="letter-picker-option"
            data-letter-id={letter.id}
            onClick={() => onPick(letter)}
            className={`flex cursor-pointer flex-col items-center rounded-xl border-2 px-1.5 py-2 transition-colors hover:border-ink ${
              letter.vowelLength === ""
                ? "border-border bg-background hover:bg-muted"
                : long
                  ? "border-sky-300 bg-sky-100 hover:bg-sky-200"
                  : "border-orange-300 bg-orange-100 hover:bg-orange-200"
            }`}
          >
            <span className="font-thai text-xl leading-none text-ink" lang="th">
              {letterDisplay(letter)}
            </span>
            <span
              className="font-thai mt-1.5 text-[10px] leading-tight text-muted-foreground"
              lang="th"
            >
              {letter.name}
            </span>
            <span className="mt-0.5 text-[9px] leading-none text-muted-foreground">
              {letter.roman}
              {letter.vowelLength ? (long ? " · ยาว" : " · สั้น") : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pick the letter a unit *is*, from the chart a Thai learner already knows.
 *
 * This replaced a "select two units and merge" flow, which was worse for a specific reason:
 * merging had to invent a name for the result, and the rule it used — take the last unit's
 * letter — was a guess dressed as a rule. `แ` + `ะ` happens to be สระแอะ, but nothing about
 * the two characters says so. Choosing สระแอะ from the chart says it outright, and the same
 * click does the merge, so a curator states an intention instead of assembling one.
 *
 * The vowels render the way every Thai classroom poster and dictionary writes them —
 * `แ–ะ`, not `แอะ` — with the dash standing where the consonant goes. That shape is the
 * whole point: it shows a vowel wrapping around its consonant, which is exactly the fact a
 * per-character split gets wrong.
 *
 * Short and long are told apart by colour *and* by the label under each tile, because
 * colour alone is never the only signal (SPEC §6.3).
 */
export function LetterPicker({
  open,
  onOpenChange,
  letters,
  /** What the picked letter will be applied to, shown so the curator can see the target. */
  preview,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  letters: AdminThaiLetter[];
  preview: string;
  onPick: (letter: AdminThaiLetter) => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const byKind = (kind: ThaiLetterKind) =>
      letters
        .filter((letter) => letter.kind === kind)
        .sort((a, b) => a.ordinal - b.ordinal);

    return {
      vowelSound: byKind("vowelSound"),
      consonant: byKind("consonant"),
      vowelSign: byKind("vowelSign"),
      tone: byKind("tone"),
    };
  }, [letters]);

  const pick = (letter: AdminThaiLetter) => {
    onPick(letter);
    onOpenChange(false);
    setQuery("");
  };

  const matches = (letter: AdminThaiLetter) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    return (
      letter.char.includes(q) ||
      letter.name.toLowerCase().includes(q) ||
      letter.roman.toLowerCase().includes(q)
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto"
        data-testid="letter-picker"
      >
        <SheetHeader>
          <SheetTitle>เลือกตัวอักษรของหน่วยนี้</SheetTitle>
          <SheetDescription>
            {preview
              ? `หน่วยที่เลือก: ${preview} — เลือกว่าจริง ๆ แล้วคือตัวไหน`
              : "เลือกหน่วยในการแยกก่อน แล้วจึงเลือกตัวอักษร"}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <Input
            placeholder="ค้นหา เช่น แอะ หรือ sara ae"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9"
            data-testid="letter-picker-search"
          />

          <Tabs defaultValue="vowelSound" className="mt-3">
            <TabsList>
              <TabsTrigger value="vowelSound" data-testid="picker-tab-vowelSound">
                สระ 32 เสียง
              </TabsTrigger>
              <TabsTrigger value="consonant">พยัญชนะ</TabsTrigger>
              <TabsTrigger value="vowelSign">รูปสระ</TabsTrigger>
              <TabsTrigger value="tone">วรรณยุกต์</TabsTrigger>
            </TabsList>

            <TabsContent value="vowelSound" className="mt-3">
              <p className="mb-2 text-[11px] text-muted-foreground">
                ขีด – คือตำแหน่งของพยัญชนะ · สีส้มคือสระเสียงสั้น สีฟ้าคือเสียงยาว
              </p>
              <LetterGrid items={groups.vowelSound.filter(matches)} onPick={pick} />
            </TabsContent>
            <TabsContent value="consonant" className="mt-3">
              <LetterGrid items={groups.consonant.filter(matches)} onPick={pick} />
            </TabsContent>
            <TabsContent value="vowelSign" className="mt-3">
              <LetterGrid items={groups.vowelSign.filter(matches)} onPick={pick} />
            </TabsContent>
            <TabsContent value="tone" className="mt-3">
              <LetterGrid items={groups.tone.filter(matches)} onPick={pick} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
