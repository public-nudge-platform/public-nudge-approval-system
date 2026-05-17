"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

type Props = {
  role: UserRole;
  user: Session["user"];
  unreadCount: number;
  children: React.ReactNode;
};

export function AppShell({ role, user, unreadCount, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-gray-50 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static column on desktop */}
      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-30 transition-transform duration-200 ease-in-out",
          "md:relative md:flex md:flex-shrink-0 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar role={role} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header
          user={user}
          unreadCount={unreadCount}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
