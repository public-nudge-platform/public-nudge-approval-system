"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { zhTW } from "react-day-picker/locale";
import { CalendarDays, X } from "lucide-react";
import "react-day-picker/style.css";

interface DateRangePickerProps {
  startName?: string;
  endName?: string;
  defaultStart?: string; // "YYYY-MM-DD"
  defaultEnd?: string;
  placeholder?: string;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function display(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Shortcut helpers ─────────────────────────────────────────────────────────

function thisMonth(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function lastMonth(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to:   new Date(now.getFullYear(), now.getMonth(), 0),
  };
}

function lastThreeMonths(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function thisYear(): DateRange {
  const y = new Date().getFullYear();
  return {
    from: new Date(y, 0, 1),
    to:   new Date(y, 11, 31),
  };
}

const SHORTCUTS: { label: string; range: () => DateRange }[] = [
  { label: "本月",   range: thisMonth },
  { label: "上個月", range: lastMonth },
  { label: "近三個月", range: lastThreeMonths },
  { label: "今年",   range: thisYear },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DateRangePicker({
  startName = "startDate",
  endName = "endDate",
  defaultStart,
  defaultEnd,
  placeholder = "選擇日期區間",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = defaultStart ? new Date(defaultStart) : undefined;
    const to = defaultEnd ? new Date(defaultEnd) : undefined;
    return from ? { from, to } : undefined;
  });
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setRange(undefined);
  }

  function applyShortcut(r: DateRange) {
    setRange(r);
    setOpen(false);
  }

  const label =
    range?.from && range?.to
      ? `${display(range.from)} — ${display(range.to)}`
      : range?.from
      ? `${display(range.from)} — 選擇結束日`
      : placeholder;

  const hasValue = !!range?.from;

  return (
    <div className="relative" ref={ref}>
      {/* Hidden inputs for form submission */}
      <input type="hidden" name={startName} value={range?.from ? fmt(range.from) : ""} />
      <input type="hidden" name={endName} value={range?.to ? fmt(range.to) : ""} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[220px]"
      >
        <CalendarDays size={14} className="text-gray-400 shrink-0" />
        <span className={hasValue ? "text-gray-800" : "text-gray-400"}>{label}</span>
        {hasValue && (
          <X
            size={13}
            className="ml-auto text-gray-400 hover:text-gray-600"
            onClick={clear}
          />
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Shortcut chips */}
          <div className="flex gap-1.5 px-3 pt-3 pb-2 border-b border-gray-100">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applyShortcut(s.range())}
                className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-2">
            <DayPicker
              mode="range"
              locale={zhTW}
              selected={range}
              onSelect={(r) => {
                setRange(r);
                // Close when both ends are picked
                if (r?.from && r?.to) setOpen(false);
              }}
              weekStartsOn={0}
            />
          </div>
        </div>
      )}
    </div>
  );
}
