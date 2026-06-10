export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckSquare, CheckCircle2, Clock } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { APPROVAL_ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { BulkApprovalPanel } from "@/components/forms/BulkApprovalPanel";

export default async function ApprovalsPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!APPROVAL_ROLES.includes(role) && role !== "ADMIN") {
    redirect("/dashboard");
  }

  const pendingRequests = await prisma.request.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: {
      submitter: { select: { name: true } },
      approvalSteps: {
        where: { records: { none: {} } },
        take: 1,
      },
    },
  });

  const items = pendingRequests.map((req) => ({
    id: req.id,
    stepId: req.approvalSteps[0]?.id ?? null,
    requestNumber: req.requestNumber,
    type: req.type,
    title: req.title,
    submitterName: req.submitter.name,
    amount: Number(req.amount),
    status: req.status,
    neededBy: req.neededBy ? req.neededBy.toISOString() : null,
    submittedAt: req.submittedAt ? req.submittedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckSquare size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">待我簽核</h1>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-700">待審核申請</h2>
          {pendingRequests.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </div>

        {pendingRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <CheckCircle2 size={40} className="mx-auto text-green-300 mb-3" />
            <p className="text-gray-500 font-medium">目前沒有待審核的申請單</p>
            <p className="text-sm text-gray-500 mt-1">所有申請都已處理完畢</p>
          </div>
        ) : (
          <BulkApprovalPanel items={items} />
        )}
      </section>
    </div>
  );
}
