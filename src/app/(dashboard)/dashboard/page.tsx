export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/ui/StatsCard";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import {
  FileText, Clock, CheckCircle, XCircle,
  AlertCircle, Banknote, TrendingUp, Users,
} from "lucide-react";
import Link from "next/link";
import { APPROVAL_ROLES, FINANCE_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

async function getDashboardStats(userId: string, role: UserRole) {
  const isApprover = APPROVAL_ROLES.includes(role) || role === "ADMIN";
  const isFinance = FINANCE_ROLES.includes(role);

  const [myTotal, myPending, myApproved, myDraft, pendingApprovals, recentRequests] =
    await Promise.all([
      prisma.request.count({ where: { submitterId: userId } }),
      prisma.request.count({ where: { submitterId: userId, status: "PENDING" } }),
      prisma.request.count({ where: { submitterId: userId, status: "APPROVED" } }),
      prisma.request.count({ where: { submitterId: userId, status: "DRAFT" } }),
      isApprover ? prisma.request.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
      prisma.request.findMany({
        where: role === "ADMIN" || isApprover ? {} : { submitterId: userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          submitter: { select: { name: true } },
        },
      }),
    ]);

  const awaitingPayment = isFinance
    ? await prisma.request.count({ where: { status: "APPROVED" } })
    : 0;

  return { myTotal, myPending, myApproved, myDraft, pendingApprovals, awaitingPayment, recentRequests };
}

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;
  const stats = await getDashboardStats(session!.user.id, role);
  const isApprover = APPROVAL_ROLES.includes(role) || role === "ADMIN";
  const isFinance = FINANCE_ROLES.includes(role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          歡迎回來，{session!.user.name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">以下是目前的案件概況</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="我的申請" value={stats.myTotal} icon={FileText} color="slate" href="/requests" />
        <StatsCard label="待審核" value={stats.myPending} icon={Clock} color="amber" href="/requests?status=PENDING" />
        <StatsCard label="已核准" value={stats.myApproved} icon={CheckCircle} color="green" href="/requests?status=APPROVED" />
        <StatsCard label="草稿" value={stats.myDraft} icon={AlertCircle} color="slate" href="/requests?status=DRAFT" />
        {isApprover && (
          <StatsCard label="待我簽核" value={stats.pendingApprovals} icon={Users} color="blue" href="/approvals" />
        )}
        {isFinance && (
          <StatsCard label="待付款" value={stats.awaitingPayment} icon={Banknote} color="purple" href="/finance" />
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">最新動態</h2>
          </div>
          <Link href="/requests" className="text-xs text-blue-600 hover:underline">
            查看全部
          </Link>
        </div>

        {stats.recentRequests.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">尚無申請記錄</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {stats.recentRequests.map((req) => (
              <li key={req.id}>
                <Link
                  href={`/requests/${req.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{req.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {req.requestNumber && (
                        <span className="text-xs text-gray-400 font-mono">{req.requestNumber}</span>
                      )}
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{req.submitter.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <TypeBadge type={req.type} />
                    <StatusBadge status={req.status} />
                    <span className="text-sm font-medium text-gray-700 tabular-nums w-24 text-right">
                      {Number(req.amount).toLocaleString()} 元
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending approvals widget (for approvers) */}
      {isApprover && stats.pendingApprovals > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <XCircle size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              有 {stats.pendingApprovals} 件申請等待您的審核
            </p>
            <p className="text-xs text-amber-600 mt-0.5">請盡快處理，避免影響申請人進度</p>
          </div>
          <Link
            href="/approvals"
            className="flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            前往簽核
          </Link>
        </div>
      )}
    </div>
  );
}
