export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { AuditLogsClient } from "./AuditLogsClient";

const ALLOWED_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"];

export default async function AuditLogsPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;
  if (!ALLOWED_ROLES.includes(role)) redirect("/dashboard");

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">操作紀錄</h1>
      </div>

      <AuditLogsClient logs={logs} users={users} />
    </div>
  );
}
