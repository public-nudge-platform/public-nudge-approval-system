export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/ui/StatsCard";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import {
  FileText, Clock, CheckCircle, XCircle,
  AlertCircle, Banknote, TrendingUp, Users, BadgeCheck, Bell, Receipt,
} from "lucide-react";
import Link from "next/link";
import { APPROVAL_ROLES, AUDIT_ACTION_LABEL, FINANCE_ROLES, OFFSET_REVIEW_ROLES } from "@/lib/constants";
import type { AuditAction, AuditLog, UserRole } from "@prisma/client";

// Roles that can only see their own request activities
const LIMITED_ROLES = new Set<UserRole>(["APPLICANT", "SECRETARY", "DIRECTOR", "SUPERVISOR"]);

// AuditActions visible per role group
const PRESIDENT_ACTIONS: AuditAction[] = [
  "REQUEST_SUBMITTED", "REQUEST_APPROVED", "REQUEST_RETURNED", "REQUEST_REJECTED",
  "REQUEST_WITHDRAWN", "PAYMENT_MARKED", "SETTLEMENT_SUBMITTED", "SETTLEMENT_RETURNED",
  "SETTLEMENT_APPROVED", "PAYMENT_ADJUSTMENT_CREATED", "PAYMENT_ADJUSTMENT_UPDATED",
  "PAYMENT_ADJUSTMENT_DELETED",
];

const FINANCE_ACTIONS: AuditAction[] = [
  "REQUEST_APPROVED", "PAYMENT_MARKED", "SETTLEMENT_SUBMITTED", "SETTLEMENT_RETURNED",
  "SETTLEMENT_APPROVED", "PAYMENT_ADJUSTMENT_CREATED", "PAYMENT_ADJUSTMENT_UPDATED",
  "PAYMENT_ADJUSTMENT_DELETED", "ACCOUNTING_SUBJECT_CHANGED",
];

const APPLICANT_ACTIONS: AuditAction[] = [
  "REQUEST_SUBMITTED", "REQUEST_APPROVED", "REQUEST_RETURNED", "REQUEST_REJECTED",
  "REQUEST_WITHDRAWN", "PAYMENT_MARKED", "SETTLEMENT_SUBMITTED", "SETTLEMENT_RETURNED",
  "SETTLEMENT_APPROVED",
];

async function getRecentActivity(userId: string, role: UserRole) {
  if (LIMITED_ROLES.has(role)) {
    const myReqs = await prisma.request.findMany({
      where: { submitterId: userId },
      select: { id: true },
      take: 300,
    });
    if (myReqs.length === 0) return [];
    const ids = myReqs.map((r) => r.id);
    return prisma.auditLog.findMany({
      where: { entityType: "Request", entityId: { in: ids }, action: { in: APPLICANT_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  if (role === "FINANCE") {
    return prisma.auditLog.findMany({
      where: { action: { in: FINANCE_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  if (role === "PRESIDENT" || role === "FOUNDER_AGENT") {
    return prisma.auditLog.findMany({
      where: { action: { in: PRESIDENT_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  // ADMIN: all except login
  return prisma.auditLog.findMany({
    where: { action: { not: "USER_LOGIN" } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

function activityLink(log: AuditLog): string | null {
  if (log.entityType === "Request" && log.entityId) return `/requests/${log.entityId}`;
  if (log.entityType === "PaymentAdjustment") {
    const d = (log.afterData ?? log.beforeData) as Record<string, unknown> | null;
    if (d?.requestId) return `/requests/${d.requestId as string}`;
  }
  return null;
}

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
  const [stats, recentActivity, recentNotifications] = await Promise.all([
    getDashboardStats(session!.user.id, role),
    getRecentActivity(session!.user.id, role),
    prisma.notification.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
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

      {/* Recent activity — role-filtered AuditLog */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">最新動態</h2>
          </div>
          <Link
            href={role === "ADMIN" ? "/admin/audit-logs" : "/requests"}
            className="text-xs text-blue-600 hover:underline"
          >
            查看全部
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm text-gray-500">尚無相關動態</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentActivity.map((log) => {
              const href = activityLink(log);
              const inner = (
                <div className="flex flex-col gap-1 px-5 py-3.5 hover:bg-gray-50 transition-colors sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-800 truncate">{log.description}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-500">{log.userName}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{AUDIT_ACTION_LABEL[log.action]}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
                    {log.createdAt.toLocaleDateString("zh-TW")}
                  </span>
                </div>
              );
              return (
                <li key={log.id}>
                  {href ? (
                    <Link href={href}>{inner}</Link>
                  ) : (
                    <div>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Recent notifications */}
      {recentNotifications.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">最近通知</h2>
            </div>
            <Link href="/notifications" className="text-xs text-blue-600 hover:underline">
              查看全部
            </Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {recentNotifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.relatedRequestId ? `/requests/${n.relatedRequestId}` : "/notifications"}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {!n.isRead && <span className="mt-1.5 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                  {n.isRead && <span className="mt-1.5 w-2 h-2 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm text-gray-900 truncate ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{n.message}</p>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString("zh-TW")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
