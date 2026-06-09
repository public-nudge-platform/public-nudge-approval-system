export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import Link from "next/link";
import { PlusCircle, Search } from "lucide-react";
import type { RequestStatus, RequestType, UserRole } from "@prisma/client";
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from "@/lib/constants";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FilterInput } from "@/components/ui/FilterInput";
import { AdvancedFiltersPanel } from "@/components/ui/AdvancedFiltersPanel";
import { ExportButton } from "@/components/ui/ExportButton";
import { RequestTemplateExportButton } from "@/components/ui/RequestTemplateExportButton";
import { FINANCE_ROLES } from "@/lib/constants";
import { Suspense } from "react";

type SearchParams = {
  status?: string;
  type?: string;
  q?: string;
  project?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  sortBy?: string;
  sortDir?: string;
  payStatus?: string;
  offsetStatus?: string;
  accountingSubject?: string;
};

const ALL_STATUSES = Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[];
const ALL_TYPES = Object.keys(REQUEST_TYPE_LABEL) as RequestType[];

const SORT_OPTIONS = [
  { value: "updatedAt", label: "更新時間" },
  { value: "createdAt", label: "建立時間" },
  { value: "requestDate", label: "申請日期" },
  { value: "amount", label: "金額" },
];

const SORT_DIR_OPTIONS = [
  { value: "desc", label: "降冪" },
  { value: "asc", label: "升冪" },
];

type SortField = "updatedAt" | "createdAt" | "requestDate" | "amount";
const VALID_SORT_FIELDS: string[] = SORT_OPTIONS.map((o) => o.value);

async function getRequests(userId: string, role: UserRole, params: SearchParams) {
  const isAdmin = role === "ADMIN";
  const isApprover = ["PRESIDENT", "FOUNDER_AGENT"].includes(role);
  const isFinance = role === "FINANCE";

  const sortBy: SortField = VALID_SORT_FIELDS.includes(params.sortBy ?? "")
    ? (params.sortBy as SortField)
    : "updatedAt";
  const sortDir = params.sortDir === "asc" ? "asc" : "desc";

  const orderByMap: Record<SortField, object> = {
    updatedAt: { updatedAt: sortDir },
    createdAt: { createdAt: sortDir },
    requestDate: { requestDate: sortDir },
    amount: { amount: sortDir },
  };

  const PAY_STATUSES: RequestStatus[] = ["APPROVED", "PAID"];
  const OFFSET_STATUSES: RequestStatus[] = ["PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED", "CLOSED"];

  const effectiveStatus: RequestStatus | undefined =
    params.status && ALL_STATUSES.includes(params.status as RequestStatus)
      ? (params.status as RequestStatus)
      : params.payStatus && PAY_STATUSES.includes(params.payStatus as RequestStatus)
      ? (params.payStatus as RequestStatus)
      : params.offsetStatus && OFFSET_STATUSES.includes(params.offsetStatus as RequestStatus)
      ? (params.offsetStatus as RequestStatus)
      : undefined;

  const where = {
    ...((!isAdmin && !isApprover && !isFinance) && { submitterId: userId }),
    ...(effectiveStatus && { status: effectiveStatus }),
    ...(params.type && ALL_TYPES.includes(params.type as RequestType) && {
      type: params.type as RequestType,
    }),
    ...(params.project && { projectId: params.project }),
    ...(params.q && {
      OR: [
        { title: { contains: params.q, mode: "insensitive" as const } },
        { requestNumber: { contains: params.q, mode: "insensitive" as const } },
        { project: { name: { contains: params.q, mode: "insensitive" as const } } },
        { description: { contains: params.q, mode: "insensitive" as const } },
        { submitter: { name: { contains: params.q, mode: "insensitive" as const } } },
        { reimbursementNote: { contains: params.q, mode: "insensitive" as const } },
        { accountingSubject: { code: { contains: params.q, mode: "insensitive" as const } } },
        { accountingSubject: { name: { contains: params.q, mode: "insensitive" as const } } },
        { finalAccountingSubject: { code: { contains: params.q, mode: "insensitive" as const } } },
        { finalAccountingSubject: { name: { contains: params.q, mode: "insensitive" as const } } },
      ],
    }),
    ...(params.accountingSubject && {
      OR: [
        { accountingSubjectId: params.accountingSubject },
        { finalAccountingSubjectId: params.accountingSubject },
      ],
    }),
    ...((params.dateFrom || params.dateTo) && {
      requestDate: {
        ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
        ...(params.dateTo && { lte: new Date(`${params.dateTo}T23:59:59`) }),
      },
    }),
    ...((params.amountMin || params.amountMax) && {
      amount: {
        ...(params.amountMin && !isNaN(Number(params.amountMin)) && { gte: Number(params.amountMin) }),
        ...(params.amountMax && !isNaN(Number(params.amountMax)) && { lte: Number(params.amountMax) }),
      },
    }),
  };

  return prisma.request.findMany({
    where,
    orderBy: orderByMap[sortBy],
    include: {
      submitter: { select: { name: true } },
      project: { select: { id: true, name: true } },
      accountingSubject: { select: { code: true, name: true } },
      finalAccountingSubject: { select: { code: true, name: true } },
    },
  });
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const role = session!.user.role as UserRole;
  const params = await searchParams;
  const [requests, projects, accountingSubjects] = await Promise.all([
    getRequests(session!.user.id, role, params),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.accountingSubject.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  const hasBasicFilters = !!(params.status || params.type || params.q || params.project || params.accountingSubject);
  const hasAdvancedFilters = !!(params.dateFrom || params.dateTo || params.amountMin || params.amountMax || params.payStatus || params.offsetStatus);
  const hasSortOverride = !!(params.sortBy || (params.sortDir && params.sortDir !== "desc"));
  const hasFilters = hasBasicFilters || hasAdvancedFilters || hasSortOverride;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">請款單管理</h1>
        <div className="flex items-center gap-2">
          {FINANCE_ROLES.includes(role) && (
            <>
              <ExportButton projects={projects} label="匯出明細" />
              <RequestTemplateExportButton projects={projects} />
            </>
          )}
          <Link
            href="/requests/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle size={15} />
            新增申請單
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <Suspense>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48 max-w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <FilterInput
                name="q"
                value={params.q}
                placeholder="搜尋標題、流水編號、申請人…"
                className="w-full pl-8 pr-3 py-1.5 text-sm text-gray-800 border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <FilterSelect
              name="project"
              value={params.project}
              label="全部專案"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
            <FilterSelect
              name="status"
              value={params.status}
              label="全部狀態"
              options={ALL_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABEL[s] }))}
            />
            <FilterSelect
              name="type"
              value={params.type}
              label="全部類型"
              options={ALL_TYPES.map((t) => ({ value: t, label: REQUEST_TYPE_LABEL[t] }))}
            />
            <FilterSelect
              name="accountingSubject"
              value={params.accountingSubject}
              label="全部科目"
              options={accountingSubjects.map((s) => ({ value: s.id, label: `${s.code} ${s.name}` }))}
            />
            <FilterSelect
              name="sortBy"
              value={params.sortBy}
              label="排序依據"
              options={SORT_OPTIONS}
            />
            <FilterSelect
              name="sortDir"
              value={params.sortDir}
              label="降冪"
              options={SORT_DIR_OPTIONS}
            />
          </div>

          <div className="flex items-center gap-4">
            <AdvancedFiltersPanel defaultOpen={hasAdvancedFilters}>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 whitespace-nowrap">申請日期</span>
                  <FilterInput name="dateFrom" type="date" value={params.dateFrom} />
                  <span className="text-xs text-gray-500">—</span>
                  <FilterInput name="dateTo" type="date" value={params.dateTo} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">金額範圍</span>
                  <FilterInput
                    name="amountMin"
                    type="number"
                    value={params.amountMin}
                    placeholder="最低"
                    className="w-24 text-sm text-gray-800 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">—</span>
                  <FilterInput
                    name="amountMax"
                    type="number"
                    value={params.amountMax}
                    placeholder="最高"
                    className="w-24 text-sm text-gray-800 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FilterSelect
                    name="payStatus"
                    value={params.payStatus}
                    label="付款狀態"
                    options={[
                      { value: "APPROVED", label: "待付款" },
                      { value: "PAID", label: "已付款" },
                    ]}
                  />
                  <FilterSelect
                    name="offsetStatus"
                    value={params.offsetStatus}
                    label="沖銷狀態"
                    options={[
                      { value: "PENDING_SETTLEMENT", label: "待沖銷" },
                      { value: "OFFSET_SUBMITTED", label: "沖銷待確認" },
                      { value: "OFFSET_RETURNED", label: "沖銷退回" },
                      { value: "CLOSED", label: "已結案" },
                    ]}
                  />
                </div>
              </div>
            </AdvancedFiltersPanel>

            {hasFilters && (
              <Link href="/requests" className="text-xs text-gray-400 hover:text-gray-600 underline">
                清除篩選
              </Link>
            )}
          </div>
        </Suspense>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <Search size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">
              {hasBasicFilters || hasAdvancedFilters ? "找不到符合條件的申請單" : "尚無申請單"}
            </p>
            {!hasBasicFilters && !hasAdvancedFilters && (
              <Link href="/requests/new" className="text-sm text-blue-600 hover:underline mt-1 block">
                建立第一筆申請單 →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">專案</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">標題</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">類型</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">申請人</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">金額</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">日期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/80 transition-colors cursor-pointer">
                    <td className="p-0">
                      <Link href={`/requests/${req.id}`} className="block px-4 py-3">
                        {req.project ? (
                          <span className="text-sm text-gray-700">{req.project.name}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={`/requests/${req.id}`} className="block px-4 py-3">
                        <span className="font-medium text-gray-900">{req.title}</span>
                        {req.requestNumber && (
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">{req.requestNumber}</p>
                        )}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={`/requests/${req.id}`} className="block px-4 py-3">
                        <TypeBadge type={req.type} />
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={`/requests/${req.id}`} className="block px-4 py-3">
                        <span className="text-gray-700">{req.submitter.name}</span>
                      </Link>
                    </td>
                    <td className="p-0 text-right">
                      <Link href={`/requests/${req.id}`} className="block px-4 py-3">
                        <span className="font-medium text-gray-900 tabular-nums">
                          {Number(req.amount).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500 ml-0.5">元</span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={`/requests/${req.id}`} className="block px-4 py-3">
                        <StatusBadge status={req.status} />
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={`/requests/${req.id}`} className="block px-4 py-3 text-gray-500 text-xs tabular-nums">
                        {req.createdAt.toLocaleDateString("zh-TW")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">共 {requests.length} 筆</p>
    </div>
  );
}
