"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

export function FilterInput({
  name,
  value,
  placeholder,
  type = "text",
  className,
}: {
  name: string;
  value?: string;
  placeholder?: string;
  type?: "text" | "date" | "number";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localValue, setLocalValue] = useState(value ?? "");

  function commit(val: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (val) {
      p.set(name, val);
    } else {
      p.delete(name);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <input
      type={type}
      value={localValue}
      placeholder={placeholder}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
      }}
      className={
        className ??
        "text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      }
    />
  );
}
