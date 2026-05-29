export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/ui/StatsCard";
import {
  FileText, Clock, CheckCircle,
  AlertCircle, Banknote, Users, BadgeCheck, Receipt,
  Landmark, TrendingUp, TrendingDown, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { APPROVAL_ROLES, FINANCE_ROLES, OFFSET_REVIEW_ROLES, FINANCE_VIEW_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";
import { WorkbenchSection } from "@/components/dashboard/WorkbenchSection";
import type { WorkbenchCardConfig, WorkbenchRequest } from "@/components/dashboard/WorkbenchSection";
import { getFinancialAccounts } from "@/lib/actions/financialAccount";

// ─── helpers ───────────────────────────────────────────────────────────────

const REQ_SELECT = {
  id: true,
  requestNumber: true,
  title: true,
  type: true,
  status: true,
  amount: true,
  updatedAt: true,
  submitter: { select: { name: true } },
  project: { select: { name: true } },
} as const;

function toItem(r: {
  id: string; requestNumber: string | null; title: string;
  type: string; status: string; amount: { toNumber(): number };
  updatedAt: Date; submitter: { name: string }; project: { name: string } | null;
}): WorkbenchRequest {
  return {
    id: r.id,
    requestNumber: r.requestNumber,
    title: r.title,
    type: r.type as WorkbenchRequest["type"],
    status: r.status as WorkbenchRequest["status"],
    amount: r.amount.toNumber(),
    updatedAt: r.updatedAt.toISOString(),
    submitterName: r.submitter.name,
    projectName: r.project?.name ?? null,
  };
}

// ─── stats (existing) ──────────────────────────────────────────────────────

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

// ─── workbench cards data ──────────────────────────────────────────────────

async function getWorkbenchCards(userId: string, role: UserRole): Promise<WorkbenchCardConfig[]> {
  const TAKE = 10;

  // ADMIN
  if (role === "ADMIN") {
    const [
      pendingList, pendingCount,
      payList, payCount,
      offsetList, offsetCount,
      trackList, trackCount,
    ] = await Promise.all([
      prisma.request.findMany({ where: { status: "PENDING" }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: "PENDING" } }),
      prisma.request.findMany({ where: { status: "APPROVED" }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: "APPROVED" } }),
      prisma.request.findMany({ where: { status: { in: ["PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED"] } }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: { in: ["PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED"] } } }),
      prisma.request.findMany({ where: { status: { notIn: ["CLOSED", "REJECTED", "WITHDRAWN", "DRAFT"] } }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: { notIn: ["CLOSED", "REJECTED", "WITHDRAWN", "DRAFT"] } } }),
    ]);
    return [
      { id: "pending", title: "待簽核", count: pendingCount, description: "等待理事長/創會理事長審核的申請單", color: "amber", href: "/approvals", items: pendingList.map(toItem), cardType: "task" },
      { id: "pay", title: "待付款", count: payCount, description: "已核准，等待行政出納付款", color: "blue", href: "/finance", items: payList.map(toItem), cardType: "task" },
      { id: "offset", title: "待沖銷", count: offsetCount, description: "進入沖銷流程的案件", color: "purple", href: "/finance", items: offsetList.map(toItem), cardType: "task" },
      { id: "track", title: "流程追蹤", count: trackCount, description: "全系統進行中案件", color: "slate", href: "/requests", items: trackList.map(toItem), cardType: "tracking" },
    ];
  }

  // PRESIDENT / FOUNDER_AGENT
  if (APPROVAL_ROLES.includes(role)) {
    const [
      pendingList, pendingCount,
      offsetReviewList, offsetReviewCount,
      trackList, trackCount,
    ] = await Promise.all([
      prisma.request.findMany({ where: { status: "PENDING" }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: "PENDING" } }),
      prisma.request.findMany({ where: { status: "OFFSET_SUBMITTED" }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: "OFFSET_SUBMITTED" } }),
      // Tracking: requests this approver has acted on, still active
      prisma.request.findMany({
        where: {
          approvalSteps: { some: { records: { some: { approverId: userId } } } },
          status: { notIn: ["DRAFT", "WITHDRAWN", "REJECTED"] },
        },
        select: REQ_SELECT,
        orderBy: { updatedAt: "desc" },
        take: TAKE,
      }),
      prisma.request.count({
        where: {
          approvalSteps: { some: { records: { some: { approverId: userId } } } },
          status: { notIn: ["DRAFT", "WITHDRAWN", "REJECTED"] },
        },
      }),
    ]);
    return [
      { id: "pending", title: "待簽核", count: pendingCount, description: "等待您審核的申請單", color: "amber", href: "/approvals", items: pendingList.map(toItem), cardType: "task" },
      { id: "offset-review", title: "沖銷待確認", count: offsetReviewCount, description: "申請人已送出沖銷，等待您確認", color: "indigo", href: "/finance", items: offsetReviewList.map(toItem), cardType: "task" },
      { id: "track", title: "流程追蹤", count: trackCount, description: "我審核過且仍在流程中的案件", color: "slate", href: "/requests", items: trackList.map(toItem), cardType: "tracking" },
    ];
  }

  // FINANCE (not admin/approver)
  if (role === "FINANCE") {
    const [
      payList, payCount,
      offsetPendingList, offsetPendingCount,
      offsetReviewList, offsetReviewCount,
      trackList, trackCount,
    ] = await Promise.all([
      prisma.request.findMany({ where: { status: "APPROVED" }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: "APPROVED" } }),
      prisma.request.findMany({ where: { status: { in: ["PENDING_SETTLEMENT", "OFFSET_RETURNED"] } }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: { in: ["PENDING_SETTLEMENT", "OFFSET_RETURNED"] } } }),
      prisma.request.findMany({ where: { status: "OFFSET_SUBMITTED" }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: "OFFSET_SUBMITTED" } }),
      // Tracking: paid / settlement stage
      prisma.request.findMany({ where: { status: { in: ["PAID", "PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED"] } }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
      prisma.request.count({ where: { status: { in: ["PAID", "PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED"] } } }),
    ]);
    return [
      { id: "pay", title: "待付款", count: payCount, description: "已核准，等待標記付款", color: "blue", href: "/finance", items: payList.map(toItem), cardType: "task" },
      { id: "offset-pending", title: "待沖銷", count: offsetPendingCount, description: "等待申請人送出沖銷資料", color: "purple", href: "/finance", items: offsetPendingList.map(toItem), cardType: "task" },
      { id: "offset-review", title: "沖銷待確認", count: offsetReviewCount, description: "申請人已送出沖銷，等待確認", color: "indigo", href: "/finance", items: offsetReviewList.map(toItem), cardType: "task" },
      { id: "track", title: "流程追蹤", count: trackCount, description: "財務相關進行中案件", color: "slate", href: "/finance", items: trackList.map(toItem), cardType: "tracking" },
    ];
  }

  // Default: APPLICANT and other roles
  const [
    toModifyList, toModifyCount,
    offsetList, offsetCount,
    trackList, trackCount,
  ] = await Promise.all([
    prisma.request.findMany({ where: { submitterId: userId, status: { in: ["RETURNED", "DRAFT"] } }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
    prisma.request.count({ where: { submitterId: userId, status: { in: ["RETURNED", "DRAFT"] } } }),
    prisma.request.findMany({ where: { submitterId: userId, status: { in: ["PENDING_SETTLEMENT", "OFFSET_RETURNED"] } }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
    prisma.request.count({ where: { submitterId: userId, status: { in: ["PENDING_SETTLEMENT", "OFFSET_RETURNED"] } } }),
    prisma.request.findMany({ where: { submitterId: userId, status: { notIn: ["CLOSED", "REJECTED", "WITHDRAWN", "DRAFT"] } }, select: REQ_SELECT, orderBy: { updatedAt: "desc" }, take: TAKE }),
    prisma.request.count({ where: { submitterId: userId, status: { notIn: ["CLOSED", "REJECTED", "WITHDRAWN", "DRAFT"] } } }),
  ]);
  return [
    { id: "to-modify", title: "待修改", count: toModifyCount, description: "需要您修改或重新送出的申請單", color: "amber", href: "/requests?status=RETURNED", items: toModifyList.map(toItem), cardType: "task" },
    { id: "offset", title: "待沖銷", count: offsetCount, description: "需要您上傳沖銷資料的案件", color: "purple", href: "/requests?status=PENDING_SETTLEMENT", items: offsetList.map(toItem), cardType: "task" },
    { id: "track", title: "流程追蹤", count: trackCount, description: "我送出、仍在流程中的案件", color: "slate", href: "/requests", items: trackList.map(toItem), cardType: "tracking" },
  ];
}

// ─── page ──────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;
  const userId = session!.user.id;

  const canViewAccounts = FINANCE_VIEW_ROLES.includes(role);
  const [stats, workbenchCards, financialAccounts] = await Promise.all([
    getDashboardStats(userId, role),
    getWorkbenchCards(userId, role),
    canViewAccounts ? getFinancialAccounts() : Promise.resolve([]),
  ]);

  const isApprover = APPROVAL_ROLES.includes(role) || role === "ADMIN";
  const isFinance = FINANCE_ROLES.includes(role);
  const isOffsetReviewer = stats.isOffsetReviewer;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          我的工作台
        </h1>
        <p className="text-sm text-gray-600 mt-0.5">歡迎回來，{session!.user.name}</p>
      </div>

      {/* Financial account balance cards */}
      {canViewAccounts && financialAccounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {financialAccounts.map((acc) => (
            <div key={acc.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Landmark size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{acc.name}</p>
                    {acc.accountLastFive && <p className="text-xs text-gray-500">後五碼：{acc.accountLastFive}</p>}
                  </div>
                </div>
                <Link
                  href={`/financial-accounts/${acc.id}`}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  查看明細 <ArrowRight size={12} />
                </Link>
              </div>

              <div>
                <p className="text-xs text-gray-500">目前餘額</p>
                <p className="text-2xl font-bold text-gray-900">
                  NT$ {acc.balance.toLocaleString("zh-TW")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={11} className="text-green-600" />
                    <p className="text-xs text-green-700">本月收入</p>
                  </div>
                  <p className="text-sm font-semibold text-green-700 mt-0.5">
                    +NT$ {acc.monthIncome.toLocaleString("zh-TW")}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1">
                    <TrendingDown size={11} className="text-red-600" />
                    <p className="text-xs text-red-700">本月支出</p>
                  </div>
                  <p className="text-sm font-semibold text-red-700 mt-0.5">
                    -NT$ {acc.monthExpense.toLocaleString("zh-TW")}
                  </p>
                </div>
              </div>

              {acc.lastTransaction && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-400">
                    最近交易：{new Date(acc.lastTransaction.date).toLocaleDateString("zh-TW")}
                    {" "}
                    <span className={acc.lastTransaction.type === "INCOME" ? "text-green-600" : "text-red-600"}>
                      {acc.lastTransaction.type === "INCOME" ? "入帳" : "出帳"}
                    </span>
                    {" "}{acc.lastTransaction.summary}{" "}
                    NT$ {acc.lastTransaction.amount.toLocaleString("zh-TW")}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <Users size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              有 {stats.pendingApprovals} 件申請等待您的審核
            </p>
            <p className="text-xs text-amber-600 mt-0.5">請盡快處理，避免影響申請人進度</p>
          </div>
          <Link
            href="/approvals"
            className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            前往簽核
          </Link>
        </div>
      )}

      {/* Role-based workbench */}
      <WorkbenchSection cards={workbenchCards} />
    </div>
  );
}
