"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";
import type { SortDir } from "@/lib/sort";

/**
 * Client-side 版本的可排序表頭（搭配 useSortToggle 使用）。
 * 視覺風格與 SortableHeader（URL-based）一致：
 * 當前排序欄位以淺藍底 + 藍字 + 方向箭頭標示，其餘欄位 hover 時顯示可點擊提示。
 */
export function ClientSortableHeader({
  label,
  field,
  currentSortBy,
  currentSortDir,
  onSort,
  align = "left",
  thClassName,
}: {
  label: string;
  field: string;
  currentSortBy: string;
  currentSortDir: SortDir;
  onSort: (field: string) => void;
  align?: "left" | "right";
  thClassName?: string;
}) {
  const isActive = currentSortBy === field;

  return (
    <th
      className={clsx(
        thClassName ?? `px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wide`,
        isActive && "bg-blue-50/70"
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={clsx(
          "inline-flex items-center gap-1 whitespace-nowrap rounded px-1 -mx-1 py-0.5 transition-colors select-none hover:bg-gray-100 cursor-pointer",
          align === "right" && "justify-end w-full",
          isActive ? "text-blue-700 font-semibold hover:bg-blue-100/70" : "text-gray-600 hover:text-gray-900"
        )}
      >
        {label}
        {isActive ? (
          currentSortDir === "asc" ? (
            <ChevronUp size={13} className="text-blue-600" />
          ) : (
            <ChevronDown size={13} className="text-blue-600" />
          )
        ) : (
          <ChevronsUpDown size={13} className="text-gray-400" />
        )}
      </button>
    </th>
  );
}
