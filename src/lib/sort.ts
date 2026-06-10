// 共用排序工具：中文姓名依筆畫排序、數字／日期比較
// 注意：Postgres 預設 collation 無法做到中文筆畫排序，
// 含「申請人」欄位的排序一律改在程式中以 Intl.Collator 處理。

export type SortDir = "asc" | "desc";

export const STROKE_COLLATOR = new Intl.Collator("zh-Hant-TW-u-co-stroke", {
  numeric: true,
  sensitivity: "base",
});

export function compareStrings(a: string, b: string, dir: SortDir = "asc") {
  const cmp = STROKE_COLLATOR.compare(a, b);
  return dir === "asc" ? cmp : -cmp;
}

export function compareNumbers(a: number, b: number, dir: SortDir = "asc") {
  const cmp = a - b;
  return dir === "asc" ? cmp : -cmp;
}

export function compareDates(
  a: Date | string | number | null | undefined,
  b: Date | string | number | null | undefined,
  dir: SortDir = "asc"
) {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return compareNumbers(ta, tb, dir);
}

/** 將可能為 null/undefined 的字串排到最後（不論 asc/desc） */
export function compareNullableStrings(a: string | null | undefined, b: string | null | undefined, dir: SortDir = "asc") {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return compareStrings(a, b, dir);
}
