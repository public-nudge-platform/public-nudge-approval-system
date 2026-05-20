export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { ACCOUNTING_MANAGE_ROLES } from "@/lib/constants";
import { AccountingSubjectsClient } from "./AccountingSubjectsClient";

export default async function AccountingSubjectsPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!ACCOUNTING_MANAGE_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const subjects = await prisma.accountingSubject.findMany({
    orderBy: { code: "asc" },
  });

  return <AccountingSubjectsClient subjects={subjects} />;
}
