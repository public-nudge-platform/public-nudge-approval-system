import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex items-center flex-wrap gap-1 text-xs text-gray-400">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={12} className="flex-shrink-0 text-gray-300" />}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-gray-600 transition-colors truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "text-gray-600 font-medium truncate" : "truncate"}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
