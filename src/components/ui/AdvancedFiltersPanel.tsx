"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

export function AdvancedFiltersPanel({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <SlidersHorizontal size={11} />
        進階篩選
        {defaultOpen && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
        )}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
