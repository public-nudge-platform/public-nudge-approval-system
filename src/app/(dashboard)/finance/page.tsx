export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import Link from "next/link";
import {
  Banknote,
  Clock,
  CheckCircle2,
  Receipt,
  AlertTriangle,
  RotateCcw,
  Search,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { FINANCE_ROLES, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FilterInput } from "@/components/ui/FilterInput";
import { ExportButton } from "@/components/ui/ExportButton";
import { Suspense } from "react";

const VIEW_OPTIONS = [
  { value: "pending", label: "待付款" },
  { value: "offset", label: "待沖銷" },
  { value: "paid", label: "已付款" },
];

type SearchParams = {
  dateFrom?: string;
  dateTo?: string;
  project?: string;
  submitter?: string;
  view?: string; // "pending" | "offset" | "paid" | undefined (all)
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!FINANCE_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const sharedWhere = {
    ...(params.project && { projectId: params.project }),
    ...(params.submitter && {
      submitter: { name: { contains: params.submitter, mode: "insensitive" as const } },
    }),
    ...((params.dateFrom || params.dateTo) && {
      requestDate: {
        ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
        ...(params.dateTo && { lte: new Date(`${params.dateTo}T23:59:59`) }),
      },
    }),
  };

  const [pendingPayment, offsetSubmitted, pendingSettlement, offsetReturned, paidRequests, projects] =
    await Promise.all([
      prisma.request.findMany({
        where: { status: "APPROVED", ...sharedWhere },
        orderBy: { updatedAt: "asc" },
        include: {
          submitter: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.request.findMany({
        where: { status: "OFFSET_SUBMITTED", ...sharedWhere },
        orderBy: { reimbursementSubmittedAt: "asc" },
        include: {
          submitter: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.request.findMany({
        where: { status: "PENDING_SETTLEMENT", ...sharedWhere },
        orderBy: { updatedAt: "asc" },
        include: {
          submitter: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.request.findMany({
        where: { status: "OFFSET_RETURNED", ...sharedWhere },
        orderBy: { updatedAt: "desc" },
        include: {
          submitter: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.request.findMany({
        where: { status: { in: ["PAID", "CLOSED"] }, ...sharedWhere },
        orderBy: { paidAt: "desc" },
        take: 100,
        include: {
          submitter: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

  const totalOffsetCount = offsetSubmitted.length + pendingSettlement.length + offsetReturned.length;
  const hasFilters = !!(params.dateFrom || params.dateTo || params.project || params.submitter || params.view);
  const showPending = !params.view || params.view === "pending";
  const showOffset = !params.view || params.view === "offset";
  const showPaid = !params.view || params.view === "paid";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Banknote size={20} className="text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">財務管理</h1>
        </div>
        <ExportButton projects={projects} />
      </div>

      {/* Filters */}
      <Suspense>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <FilterInput
              name="submitter"
              value={params.submitter}
              placeholder="搜尋申請人…"
              className="pl-8 pr-3 py-1.5 text-sm text-gray-800 border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <FilterSelect
            name="project"
            value={params.project}
            label="全部專案"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <FilterSelect
            name="view"
            value={params.view}
            label="全部分類"
            options={VIEW_OPTIONS}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600 whitespace-nowrap">申請日期</span>
            <FilterInput name="dateFrom" type="date" value={params.dateFrom} />
            <span className="text-xs text-gray-500">—</span>
            <FilterInput name="dateTo" type="date" value={params.dateTo} />
          </div>
          {hasFilters && (
            <Link href="/finance" className="text-xs text-gray-400 hover:text-gray-600 underline">
              清除篩選
            </Link>
          )}
        </div>
      </Suspense>

      {/* Pending payment */}
      {showPending && <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-700">待付款</h2>
          {pendingPayment.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pendingPayment.length}
            </span>
          )}
        </div>

        {pendingPayment.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
            <CheckCircle2 size={36} className="mx-auto text-green-300 mb-2" />
            <p className="text-gray-500 font-medium text-sm">
              {hasFilters ? "找不到符合條件的待付款項目" : "目前沒有待付款項目"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingPayment.map((req) => (
              <Link
                key={req.id}
                href={`/requests/${req.id}?from=/finance`}
                className="flex flex-col gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={req.type} />
                    {req.requestNumber && (
                      <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 mt-1">{req.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{req.submitter.name}</p>
                  {req.neededBy && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      需款期限：{req.neededBy.toLocaleDateString("zh-TW")}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between flex-shrink-0 sm:flex-col sm:items-end sm:text-right">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">
                    {Number(req.amount).toLocaleString()} 元
                  </p>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={req.status} />
                    <p className="text-xs text-gray-500">點擊進入詳情頁付款</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>}

      {/* Offset section */}
      {showOffset && <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Receipt size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">預付款沖銷</h2>
          {totalOffsetCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {totalOffsetCount}
            </span>
          )}
        </div>

        {totalOffsetCount === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <CheckCircle2 size={28} className="mx-auto text-green-300 mb-2" />
            <p className="text-gray-500 font-medium text-sm">
              {hasFilters ? "找不到符合條件的沖銷項目" : "目前沒有待沖銷項目"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* OFFSET_SUBMITTED: ready for review */}
            {offsetSubmitted.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                  <AlertTriangle size={11} />
                  以下沖銷單已由申請人送出，待財務確認
                </p>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Mobile card list */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {offsetSubmitted.map((req) => {
                      const prepaid = Number(req.amount);
                      const actual = req.actualAmount ? Number(req.actualAmount) : null;
                      const diff = actual !== null ? actual - prepaid : null;
                      return (
                        <Link
                          key={req.id}
                          href={`/requests/${req.id}?from=/finance`}
                          className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <p className="font-medium text-gray-900 truncate">{req.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {req.requestNumber && (
                              <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                            )}
                            {req.project && (
                              <span className="text-xs text-gray-500 truncate">{req.project.name}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                            <span>{req.submitter.name}</span>
                            <span>{req.reimbursementSubmittedAt?.toLocaleDateString("zh-TW") ?? "—"}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-sm tabular-nums">
                            <span className="text-gray-900 font-medium">
                              預付 {prepaid.toLocaleString()}
                              {actual !== null && (
                                <span className="text-gray-500 font-normal"> ／ 實支 {actual.toLocaleString()}</span>
                              )}
                            </span>
                            {diff === null ? (
                              <span className="text-gray-500 text-xs">—</span>
                            ) : diff === 0 ? (
                              <span className="text-green-600 font-medium text-xs">相符</span>
                            ) : diff < 0 ? (
                              <span className="text-amber-600 font-medium text-xs">
                                -{Math.abs(diff).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium text-xs">+{diff.toLocaleString()}</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">申請單</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">申請人</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">預付金額</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">實際支出</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">差額</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">送出日期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {offsetSubmitted.map((req) => {
                          const prepaid = Number(req.amount);
                          const actual = req.actualAmount ? Number(req.actualAmount) : null;
                          const diff = actual !== null ? actual - prepaid : null;
                          return (
                            <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <Link href={`/requests/${req.id}?from=/finance`} className="hover:text-indigo-600">
                                  <p className="font-medium text-gray-900 truncate max-w-[160px]">
                                    {req.title}
                                  </p>
                                  {req.requestNumber && (
                                    <p className="font-mono text-xs text-gray-500">{req.requestNumber}</p>
                                  )}
                                  {req.project && (
                                    <p className="text-xs text-gray-500 truncate max-w-[160px]">
                                      {req.project.name}
                                    </p>
                                  )}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-sm">{req.submitter.name}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                                {prepaid.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {actual !== null ? (
                                  <span className="font-medium text-gray-900">{actual.toLocaleString()}</span>
                                ) : (
                                  <span className="text-gray-500">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-xs">
                                {diff === null ? (
                                  <span className="text-gray-500">—</span>
                                ) : diff === 0 ? (
                                  <span className="text-green-600 font-medium">相符</span>
                                ) : diff < 0 ? (
                                  <span className="text-amber-600 font-medium">
                                    -{Math.abs(diff).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-red-600 font-medium">+{diff.toLocaleString()}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {req.reimbursementSubmittedAt?.toLocaleDateString("zh-TW") ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PENDING_SETTLEMENT: waiting for applicant */}
            {pendingSettlement.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 font-medium">申請人尚未送出沖銷</p>
                {pendingSettlement.map((req) => (
                  <Link
                    key={req.id}
                    href={`/requests/${req.id}?from=/finance`}
                    className="flex flex-col gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-400 hover:shadow-sm transition-all opacity-75 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={req.type} />
                        {req.requestNumber && (
                          <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 mt-1">{req.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{req.submitter.name}</p>
                    </div>
                    <div className="flex items-center justify-between flex-shrink-0 sm:flex-col sm:items-end sm:text-right">
                      <p className="text-lg font-bold text-gray-900 tabular-nums">
                        {Number(req.amount).toLocaleString()} 元
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* OFFSET_RETURNED: returned, waiting for re-submission */}
            {offsetReturned.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
                  <RotateCcw size={11} />
                  以下沖銷已退回補件，等待申請人重新送出
                </p>
                {offsetReturned.map((req) => (
                  <Link
                    key={req.id}
                    href={`/requests/${req.id}?from=/finance`}
                    className="flex flex-col gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={req.type} />
                        {req.requestNumber && (
                          <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 mt-1">{req.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{req.submitter.name}</p>
                    </div>
                    <div className="flex items-center justify-between flex-shrink-0 sm:flex-col sm:items-end sm:text-right">
                      <p className="text-lg font-bold text-gray-900 tabular-nums">
                        {Number(req.amount).toLocaleString()} 元
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>}

      {/* Paid records */}
      {showPaid && <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-green-500" />
          <h2 className="text-sm font-semibold text-gray-700">已付款／已沖銷紀錄</h2>
          {paidRequests.length > 0 && (
            <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {paidRequests.length}
            </span>
          )}
        </div>

        {paidRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-500">
              {hasFilters ? "找不到符合條件的付款紀錄" : "尚無付款紀錄"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-100">
              {paidRequests.map((req) => (
                <div key={req.id} className="px-4 py-3">
                  <Link href={`/requests/${req.id}?from=/finance`} className="block hover:text-blue-600 transition-colors">
                    <p className="font-medium text-gray-900">{req.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {req.requestNumber && (
                        <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                      )}
                      {req.project && (
                        <span className="text-xs text-gray-500 truncate">{req.project.name}</span>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-gray-500">{req.submitter.name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-base font-semibold text-gray-900 tabular-nums">
                      {Number(req.amount).toLocaleString()} 元
                    </p>
                    <p className="text-xs text-gray-500">
                      {req.paidAt?.toLocaleDateString("zh-TW") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
                    <span>
                      {req.paymentMethod ? (PAYMENT_METHOD_LABEL[req.paymentMethod] ?? req.paymentMethod) : "—"}
                      {req.paymentRecipientName ? ` · ${req.paymentRecipientName}` : ""}
                      {req.bankLastFive ? ` · *${req.bankLastFive}` : ""}
                    </span>
                    <Link
                      href={`/requests/${req.id}?from=/finance#payment-adjustments`}
                      className="whitespace-nowrap text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition-colors"
                    >
                      回填對帳
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600">申請單</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">申請人</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">付款方式</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">付款對象</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">帳號後五碼</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">付款人</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600">金額</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600">付款日期</th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paidRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/requests/${req.id}?from=/finance`} className="hover:text-blue-600 transition-colors">
                          <p className="font-medium text-gray-900">{req.title}</p>
                          {req.requestNumber && (
                            <p className="font-mono text-xs text-gray-500">{req.requestNumber}</p>
                          )}
                          {req.project && (
                            <p className="text-xs text-gray-500">{req.project.name}</p>
                          )}
                        </Link>
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{req.submitter.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {req.paymentMethod ? (PAYMENT_METHOD_LABEL[req.paymentMethod] ?? req.paymentMethod) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{req.paymentRecipientName || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {req.bankLastFive ? `*${req.bankLastFive}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{req.paidBy || "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        {Number(req.amount).toLocaleString()} 元
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">
                        {req.paidAt?.toLocaleDateString("zh-TW") || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/requests/${req.id}?from=/finance#payment-adjustments`}
                          className="whitespace-nowrap text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition-colors"
                        >
                          回填對帳
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>}
    </div>
  );
}
