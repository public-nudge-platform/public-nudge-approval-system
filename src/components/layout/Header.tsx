"use client";

import { signOut } from "next-auth/react";
import { LogOut, User, Bell } from "lucide-react";
import type { Session } from "next-auth";
import { USER_ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@prisma/client";
import { useState } from "react";
import Link from "next/link";

type Props = {
  user: Session["user"];
  unreadCount: number;
};

export function Header({ user, unreadCount }: Props) {
  const [open, setOpen] = useState(false);
  const roleLabel = USER_ROLE_LABEL[user.role as UserRole] ?? "";

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200 flex-shrink-0">
      <div />
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="通知"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={14} className="text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user.name}</p>
              <p className="text-xs text-gray-400 leading-tight">{roleLabel}</p>
            </div>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-900 truncate">{user.email}</p>
                  <p className="text-xs text-gray-400">{roleLabel}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  登出
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
