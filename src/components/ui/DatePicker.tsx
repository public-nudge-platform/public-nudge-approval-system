"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { zhTW } from "react-day-picker/locale";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string;           // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
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

const dpClassNames = {
  root:            "w-full",
  months:          "relative",
  month:           "w-full",
  month_caption:   "flex items-center justify-center h-8 mb-1",
  caption_label:   "text-sm font-medium text-gray-700",
  nav:             "absolute inset-x-0 top-0 flex items-center justify-between pointer-events-none",
  button_previous: "pointer-events-auto p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors",
  button_next:     "pointer-events-auto p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors",
  month_grid:      "w-full border-collapse",
  weekdays:        "",
  weekday:         "w-9 h-7 text-[11px] font-medium text-gray-400 text-center",
  week:            "",
  day:             "p-0 text-center",
  day_button:      "w-9 h-8 text-sm rounded transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1",
  today:           "font-semibold text-blue-600",
  selected:        "bg-blue-500 text-white rounded hover:bg-blue-500 hover:text-white",
  outside:         "text-gray-300",
  disabled:        "text-gray-200 cursor-not-allowed",
  hidden:          "invisible",
};

export function DatePicker({ value, onChange, placeholder = "選擇日期", className = "" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : undefined;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  const label = selected ? display(selected) : placeholder;
  const hasValue = !!selected;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
      >
        <CalendarDays size={14} className="text-gray-400 shrink-0" />
        <span className={hasValue ? "text-gray-800" : "text-slate-400"}>{label}</span>
        {hasValue && (
          <X size={12} className="ml-auto text-gray-400 hover:text-gray-600" onClick={clear} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-3">
            <DayPicker
              mode="single"
              locale={zhTW}
              selected={selected}
              onSelect={(d) => {
                onChange(d ? fmt(d) : "");
                setOpen(false);
              }}
              weekStartsOn={0}
              classNames={dpClassNames}
              components={{
                Chevron: ({ orientation }) =>
                  orientation === "left" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
