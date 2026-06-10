"use client";

import { useState } from "react";
import type { SortDir } from "@/lib/sort";

/**
 * 管理 client-side 表格排序狀態（欄位 + 方向）。
 * 點擊新欄位預設為 desc，再次點擊同一欄位則切換 asc/desc。
 */
export function useSortToggle(initialField: string, initialDir: SortDir = "desc") {
  const [sort, setSort] = useState<{ field: string; dir: SortDir }>({
    field: initialField,
    dir: initialDir,
  });

  function toggle(field: string) {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, dir: prev.dir === "desc" ? "asc" : "desc" };
      }
      return { field, dir: "desc" };
    });
  }

  return { sortBy: sort.field, sortDir: sort.dir, toggle };
}
