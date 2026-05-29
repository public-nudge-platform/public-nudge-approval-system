"use client";

import { signOut } from "next-auth/react";
import { LogOut, User, Bell, Menu } from "lucide-react";
import type { Session } from "next-auth";
import { USER_ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@prisma/client";
import { useState } from "react";
import Link from "next/link";

type Props = {
  user: Session["user"];
  unreadCount: number;
  onMenuClick: () => void;
};

type RecentNotif = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedRequestId: string | null;
  createdAt: string;
};

export function Header({ user, unreadCount, onMenuClick }: Props) {
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<RecentNotif[] | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const roleLabel = USER_ROLE_LABEL[user.role as UserRole] ?? "";

  async function handleBellClick() {
    if (notifOpen) {
      setNotifOpen(false);
      return;
    }
    setNotifOpen(true);
    setUserOpen(false);
    if (notifs === null) {
      setNotifLoading(true);
      try {
        const res = await fetch("/api/notifications/recent");
        const data = await res.json();
        setNotifs(data.notifications ?? []);
      } catch {
        setNotifs([]);
      } finally {
        setNotifLoading(false);
      }
    }
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-200 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="開啟選單"
      >
        <Menu size={20} />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">

        {/* Notification bell + drawer */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="通知"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">通知</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {unreadCount} 未讀
                    </span>
                  )}
                </div>

                {/* List */}
                {notifLoading ? (
                  <div className="py-8 text-center text-xs text-gray-400">載入中…</div>
                ) : notifs && notifs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">尚無通知</div>
                ) : (
                  <ul className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
                    {(notifs ?? []).map((n) => (
                      <li key={n.id}>
                        <Link
                          href={n.relatedRequestId ? `/requests/${n.relatedRequestId}` : "/notifications"}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                              n.isRead ? "bg-transparent" : "bg-blue-500"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${n.isRead ? "text-gray-700" : "font-semibold text-gray-900"}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(n.createdAt).toLocaleDateString("zh-TW")}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Footer */}
                <div className="border-t border-gray-100 px-4 py-2.5">
                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="block text-center text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    前往通知中心
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
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

          {userOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
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
