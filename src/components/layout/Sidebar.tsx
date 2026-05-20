"use client";

import Link from "next/link";
import Image from "next/image";
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
  FolderOpen,
  Bell,
  ClipboardList,
  BookUser,
  BookOpen,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type NavContext = { onClose?: () => void };

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "首頁", icon: LayoutDashboard },
  { href: "/requests", label: "請款單管理", icon: FileText },
  { href: "/notifications", label: "通知中心", icon: Bell },
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

function NavLink({ item, isActive, onClose }: { item: NavItem; isActive: boolean } & NavContext) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
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

function NavSection({ title, items, pathname, onClose }: { title?: string; items: NavItem[]; pathname: string } & NavContext) {
  return (
    <div>
      {title && (
        <p className="px-3 pt-5 pb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              item={item}
              isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
              onClose={onClose}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar({ role, onClose }: { role: UserRole; onClose?: () => void }) {
  const pathname = usePathname();
  const isApprover = ["PRESIDENT", "FOUNDER_AGENT", "ADMIN"].includes(role);
  const isFinance = ["FINANCE", "ADMIN", "PRESIDENT", "FOUNDER_AGENT"].includes(role);
  const canManageUsers = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"].includes(role);
  const canManageRecipients = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"].includes(role);
  const canManageAccounting = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"].includes(role);
  const isAdmin = role === "ADMIN";

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Image
            src="/公民幫推--logo去背.png"
            alt="Public Nudge"
            width={80}
            height={40}
            className="shrink-0 object-contain"
          />
          <div className="min-w-0 leading-tight">
            <p className="whitespace-nowrap text-sm font-bold text-gray-900">公民幫推</p>
            <p className="mt-0.5 whitespace-nowrap text-xs font-medium text-gray-500">簽核管理系統</p>
          </div>
        </div>
      </div>

      {/* Quick action */}
      <div className="px-3 pt-4">
        <Link
          href="/requests/new"
          onClick={onClose}
          className="flex items-center gap-2 w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle size={15} />
          新增申請單
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0 overflow-y-auto">
        <NavSection items={mainNav} pathname={pathname} onClose={onClose} />
        {isApprover && <NavSection title="簽核" items={approverNav} pathname={pathname} onClose={onClose} />}
        {isFinance && <NavSection title="財務" items={financeNav} pathname={pathname} onClose={onClose} />}
        {isFinance && <NavSection title="專案" items={[{ href: "/projects", label: "專案管理", icon: FolderOpen }]} pathname={pathname} onClose={onClose} />}
        {(canManageUsers || canManageRecipients || canManageAccounting) && (
          <NavSection
            title="管理"
            items={[
              ...(canManageUsers ? [
                { href: "/admin/users", label: "使用者管理", icon: Users },
                { href: "/admin/audit-logs", label: "操作紀錄", icon: ClipboardList },
              ] : []),
              ...(canManageRecipients ? [
                { href: "/admin/recipients", label: "付款對象", icon: BookUser },
              ] : []),
              ...(canManageAccounting ? [
                { href: "/admin/accounting-subjects", label: "會計科目", icon: BookOpen },
              ] : []),
            ]}
            pathname={pathname}
            onClose={onClose}
          />
        )}
        {isAdmin && <NavSection items={[{ href: "/admin/settings", label: "系統設定", icon: Settings }]} pathname={pathname} onClose={onClose} />}
      </nav>
    </aside>
  );
}
