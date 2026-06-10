import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { ACCENT_COLOR, type AccentColor } from "@/lib/constants";

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: AccentColor;
  href?: string;
}

export function StatsCard({ label, value, icon: Icon, color = "blue", href }: StatsCardProps) {
  const colors = ACCENT_COLOR[color];
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={clsx("flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center", colors.icon)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-600 truncate">{label}</p>
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
