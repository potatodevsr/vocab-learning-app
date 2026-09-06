import { expect, test } from "@playwright/test";
import { readTrustedPool, trustedThai, trustedPronunciation } from "../../backend/src/helpers/thai-text";
import * as webThai from "../../lib/thai-text";

test("practice and public pages apply the same mechanical Thai rules", () => {
  for (const value of ["", "nau", "แอ้เดระ a", "via Wai", "หรี่ IW (ร ) ถึ", "va waa",
    "เอ๊ 9", "แม้ (ร ) 4", "3 มิติ", "กระทํา", "v. เป็น", "เกี่ยวกับ", "ขี"]) {
    expect(trustedThai(value), value).toBe(webThai.trustedThai(value));
    expect(trustedPronunciation(value), value).toBe(webThai.trustedPronunciation(value));
  }
  // A mechanically valid mistranslation still needs editorial review, not auto-approval.
  expect(trustedThai("ขี")).toBe("ขี");
});

test("a corrupt first page does not hide usable meanings on the next page", async () => {
  const rows = ["nau", "via Wai", "แอ้ a", "หมายหนึ่ง", "หมายสอง", "หมายสาม", "หมายสี่"]
    .map((meaningTh, id) => ({ id, meaningTh }));
  const reads: number[] = [];
  const pool = await readTrustedPool(async (skip, take) => {
    reads.push(skip);
    return rows.slice(skip, skip + take);
  }, 3);
  expect(reads).toEqual([0, 3]);
  expect(pool.map((word) => word.id)).toEqual([3, 4, 5]);
});

test("a short exhausted scope stays short and optional OCR does not drop its valid word", async () => {
  const rows = [{ meaningTh: "เกี่ยวกับ", pronunciationTh: "แอ้เดระ a" }, { meaningTh: "nau", pronunciationTh: "" }];
  const pool = await readTrustedPool(async () => rows, 4);
  expect(pool).toEqual([rows[0]]);
  expect(trustedPronunciation(pool[0].pronunciationTh)).toBeNull();
});

test("a wholly corrupt scope exhausts instead of returning damaged options", async () => {
  let reads = 0;
  expect(await readTrustedPool(async () => {
    reads += 1;
    return reads === 1 ? [{ meaningTh: "nau" }, { meaningTh: "in" }] : [];
  }, 2)).toEqual([]);
  expect(reads).toBe(2);
});
