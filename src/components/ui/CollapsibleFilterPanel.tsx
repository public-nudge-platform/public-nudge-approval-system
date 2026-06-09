"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

interface Props {
  summary: string;          // e.g. "2026/5/1 — 2026/5/31・全部專案"
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

export function CollapsibleFilterPanel({ summary, defaultCollapsed = false, children }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (collapsed) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal size={13} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-600 truncate">{summary}</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          修改條件
          <ChevronDown size={12} />
        </button>
      </div>
    );
  }

  return (
    <div>
      {children}
    </div>
  );
}
