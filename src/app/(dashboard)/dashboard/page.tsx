export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/ui/StatsCard";
import {
  FileText, Clock, CheckCircle, XCircle,
  AlertCircle, Banknote, Users, BadgeCheck, Receipt,
} from "lucide-react";
import Link from "next/link";
import { APPROVAL_ROLES, FINANCE_ROLES, OFFSET_REVIEW_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

async function getDashboardStats(userId: string, role: UserRole) {
  const isApprover = APPROVAL_ROLES.includes(role) || role === "ADMIN";
  const isFinance = FINANCE_ROLES.includes(role);
  const isOffsetReviewer = OFFSET_REVIEW_ROLES.includes(role) || role === "ADMIN";

  const [myTotal, myPending, myApproved, myDraft, myPaid, myPendingOffset, pendingApprovals] =
    await Promise.all([
      prisma.request.count({ where: { submitterId: userId } }),
      prisma.request.count({ where: { submitterId: userId, status: "PENDING" } }),
      prisma.request.count({ where: { submitterId: userId, status: "APPROVED" } }),
      prisma.request.count({ where: { submitterId: userId, status: "DRAFT" } }),
      prisma.request.count({ where: { submitterId: userId, status: "PAID" } }),
      prisma.request.count({
        where: {
          submitterId: userId,
          status: { in: ["PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED"] },
        },
      }),
      isApprover ? prisma.request.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    ]);

  const [awaitingPayment, awaitingOffsetReview, allPendingOffset] = isFinance
    ? await Promise.all([
        prisma.request.count({ where: { status: "APPROVED" } }),
        prisma.request.count({ where: { status: "OFFSET_SUBMITTED" } }),
        prisma.request.count({
          where: { status: { in: ["PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED"] } },
        }),
      ])
    : isOffsetReviewer
    ? [0, await prisma.request.count({ where: { status: "OFFSET_SUBMITTED" } }), 0]
    : [0, 0, 0];

  return { myTotal, myPending, myApproved, myDraft, myPaid, myPendingOffset, pendingApprovals, awaitingPayment, awaitingOffsetReview, allPendingOffset, isOffsetReviewer };
}

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;
  const stats = await getDashboardStats(session!.user.id, role);
  const isApprover = APPROVAL_ROLES.includes(role) || role === "ADMIN";
  const isFinance = FINANCE_ROLES.includes(role);
  const isOffsetReviewer = stats.isOffsetReviewer;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          歡迎回來，{session!.user.name}
        </h1>
        <p className="text-sm text-gray-600 mt-0.5">以下是目前的案件概況</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="我的申請" value={stats.myTotal} icon={FileText} color="slate" href="/requests" />
        <StatsCard label="待審核" value={stats.myPending} icon={Clock} color="amber" href="/requests?status=PENDING" />
        <StatsCard label="已核准，待付款" value={stats.myApproved} icon={CheckCircle} color="green" href="/requests?status=APPROVED" />
        <StatsCard label="已付款" value={stats.myPaid} icon={BadgeCheck} color="blue" href="/requests?status=PAID" />
        <StatsCard label="草稿" value={stats.myDraft} icon={AlertCircle} color="slate" href="/requests?status=DRAFT" />
        {isFinance ? (
          <StatsCard label="待沖銷" value={stats.allPendingOffset} icon={Receipt} color="purple" href="/finance" />
        ) : stats.myPendingOffset > 0 ? (
          <StatsCard label="待沖銷" value={stats.myPendingOffset} icon={Receipt} color="purple" href="/requests?status=PENDING_SETTLEMENT" />
        ) : null}
        {isApprover && (
          <StatsCard label="待我簽核" value={stats.pendingApprovals} icon={Users} color="blue" href="/approvals" />
        )}
        {isFinance && (
          <StatsCard label="待付款" value={stats.awaitingPayment} icon={Banknote} color="purple" href="/finance" />
        )}
        {isOffsetReviewer && stats.awaitingOffsetReview > 0 && (
          <StatsCard label="沖銷待確認" value={stats.awaitingOffsetReview} icon={Receipt} color="blue" href="/finance" />
        )}
      </div>

      {/* Pending approvals prompt */}
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
