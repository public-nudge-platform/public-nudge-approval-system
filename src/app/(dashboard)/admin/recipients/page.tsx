export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { BookUser } from "lucide-react";
import { RecipientsClient } from "./RecipientsClient";

const MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"];

export default async function RecipientsPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!MANAGE_ROLES.includes(role)) redirect("/dashboard");

  const recipients = await prisma.paymentRecipient.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookUser size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">常用付款對象</h1>
      </div>
      <RecipientsClient recipients={recipients} />
    </div>
  );
}
