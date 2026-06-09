export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import Link from "next/link";
import { CheckSquare, CheckCircle2, Clock } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { APPROVAL_ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";

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
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <Link
                key={req.id}
                href={`/requests/${req.id}?from=/approvals`}
                className="flex flex-col gap-3 bg-white rounded-xl border border-blue-200 px-5 py-4 hover:border-blue-400 hover:shadow-sm transition-all sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={req.type} />
                    {req.requestNumber && (
                      <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 mt-1">{req.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {req.submitter.name}
                  </p>
                  {req.neededBy && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      需款期限：{req.neededBy.toLocaleDateString("zh-TW")}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between flex-shrink-0 sm:flex-col sm:items-end sm:text-right">
                  <div>
                    <p className="text-lg font-bold text-gray-900 tabular-nums">
                      {Number(req.amount).toLocaleString()} 元
                    </p>
                    {req.submittedAt && (
                      <p className="text-xs text-gray-400 mt-0.5 sm:text-right">
                        {req.submittedAt.toLocaleDateString("zh-TW")} 送出
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={req.status} />
                    <p className="text-xs text-gray-400">點擊進入詳情頁簽核</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
