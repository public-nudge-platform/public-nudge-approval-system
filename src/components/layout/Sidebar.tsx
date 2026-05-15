"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Banknote,
  Users,
  Settings,
  PlusCircle,
  ChevronRight,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "首頁", icon: LayoutDashboard },
  { href: "/requests", label: "請款單管理", icon: FileText },
];

const approverNav: NavItem[] = [
  { href: "/approvals", label: "待我簽核", icon: CheckSquare },
];

const financeNav: NavItem[] = [
  { href: "/finance", label: "財務管理", icon: Banknote },
];

const adminNav: NavItem[] = [
  { href: "/admin/users", label: "使用者管理", icon: Users },
  { href: "/admin/settings", label: "系統設定", icon: Settings },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group",
        isActive
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {isActive && <ChevronRight size={14} className="opacity-60" />}
    </Link>
  );
}

function NavSection({ title, items, pathname }: { title?: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      {title && (
        <p className="px-3 pt-5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              item={item}
              isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const isApprover = ["PRESIDENT", "FOUNDER_AGENT", "ADMIN"].includes(role);
  const isFinance = ["FINANCE", "ADMIN", "PRESIDENT", "FOUNDER_AGENT"].includes(role);
  const canManageUsers = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"].includes(role);
  const isAdmin = role === "ADMIN";

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Public Nudge</p>
            <p className="text-[10px] text-gray-400 leading-tight">請款簽核系統</p>
          </div>
        </div>
      </div>

      {/* Quick action */}
      {["APPLICANT", "ADMIN"].includes(role) && (
        <div className="px-3 pt-4">
          <Link
            href="/requests/new"
            className="flex items-center gap-2 w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle size={15} />
            新增申請單
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0 overflow-y-auto">
        <NavSection items={mainNav} pathname={pathname} />
        {isApprover && <NavSection title="簽核" items={approverNav} pathname={pathname} />}
        {isFinance && <NavSection title="財務" items={financeNav} pathname={pathname} />}
        {canManageUsers && <NavSection title="管理" items={[{ href: "/admin/users", label: "使用者管理", icon: Users }]} pathname={pathname} />}
        {isAdmin && <NavSection items={[{ href: "/admin/settings", label: "系統設定", icon: Settings }]} pathname={pathname} />}
      </nav>
    </aside>
  );
}
