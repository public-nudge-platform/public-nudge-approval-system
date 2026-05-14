import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: "blue" | "amber" | "green" | "red" | "purple" | "slate";
  href?: string;
}

const colorMap = {
  blue:   { icon: "bg-blue-50 text-blue-600",   value: "text-blue-700" },
  amber:  { icon: "bg-amber-50 text-amber-600",  value: "text-amber-700" },
  green:  { icon: "bg-green-50 text-green-600",  value: "text-green-700" },
  red:    { icon: "bg-red-50 text-red-600",      value: "text-red-700" },
  purple: { icon: "bg-purple-50 text-purple-600", value: "text-purple-700" },
  slate:  { icon: "bg-slate-100 text-slate-600", value: "text-slate-700" },
};

export function StatsCard({ label, value, icon: Icon, color = "blue", href }: StatsCardProps) {
  const colors = colorMap[color];
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={clsx("flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center", colors.icon)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className={clsx("text-2xl font-bold mt-0.5 tabular-nums", colors.value)}>{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block hover:shadow-sm transition-shadow rounded-xl">
        {content}
      </a>
    );
  }

  return content;
}
