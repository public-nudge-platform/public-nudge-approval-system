"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function FilterSelect({ name, value, label, options }: {
  name: string;
  value?: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(val: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set(name, val);
    } else {
      params.delete(name);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
