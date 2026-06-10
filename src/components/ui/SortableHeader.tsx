import Link from "next/link";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";

type SortDir = "asc" | "desc";

export function SortableHeader({
  label,
  field,
  currentSortBy,
  currentSortDir,
  basePath,
  searchParams,
  align = "left",
  thClassName,
  sortByParam = "sortBy",
  sortDirParam = "sortDir",
}: {
  label: string;
  field: string;
  currentSortBy: string;
  currentSortDir: SortDir;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  align?: "left" | "right";
  thClassName?: string;
  /** 自訂排序參數名稱，供同一頁面有多組獨立排序表格時使用（避免互相覆蓋） */
  sortByParam?: string;
  sortDirParam?: string;
}) {
  const isActive = currentSortBy === field;
  const nextDir: SortDir = isActive && currentSortDir === "desc" ? "asc" : "desc";

  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && key !== sortByParam && key !== sortDirParam) {
      sp.set(key, value);
    }
  }
  sp.set(sortByParam, field);
  sp.set(sortDirParam, nextDir);
  const href = `${basePath}?${sp.toString()}`;

  return (
    <th
      className={clsx(
        thClassName ?? `px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wide`,
        isActive && "bg-blue-50/70"
      )}
    >
      <Link
        href={href}
        className={clsx(
          "inline-flex items-center gap-1 whitespace-nowrap rounded px-1 -mx-1 py-0.5 transition-colors select-none hover:bg-gray-100",
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
      </Link>
    </th>
  );
}
