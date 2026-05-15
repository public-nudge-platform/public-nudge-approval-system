export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { UserTable } from "./UserTable";

const ALLOWED_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"];

export default async function AdminUsersPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!ALLOWED_ROLES.includes(role)) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">使用者管理</h1>
      </div>

      <UserTable
        users={users}
        actorRole={role}
        actorId={session!.user.id}
      />
    </div>
  );
}
