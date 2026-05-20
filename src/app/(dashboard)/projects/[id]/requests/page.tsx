export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_COLOR,
  PROJECT_VIEW_ROLES,
  REQUEST_STATUS_LABEL,
} from "@/lib/constants";
import type { RequestStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { clsx } from "clsx";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FilterInput } from "@/components/ui/FilterInput";
import { Suspense } from "react";

type SearchParams = {
  status?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: string;
};

const ALL_STATUSES = Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[];

const SORT_OPTIONS = [
  { value: "createdAt", label: "建立時間" },
  { value: "requestDate", label: "申請日期" },
  { value: "amount", label: "金額" },
  { value: "updatedAt", label: "更新時間" },
];

const SORT_DIR_OPTIONS = [
  { value: "desc", label: "降冪" },
  { value: "asc", label: "升冪" },
];

type SortField = "createdAt" | "requestDate" | "amount" | "updatedAt";
const VALID_SORT_FIELDS: string[] = SORT_OPTIONS.map((o) => o.value);

export default async function ProjectRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!PROJECT_VIEW_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const [{ id }, filters] = await Promise.all([params, searchParams]);

  const sortBy: SortField = VALID_SORT_FIELDS.includes(filters.sortBy ?? "")
    ? (filters.sortBy as SortField)
    : "createdAt";
  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";

  const orderByMap: Record<SortField, object> = {
    createdAt: { createdAt: sortDir },
    requestDate: { requestDate: sortDir },
    amount: { amount: sortDir },
    updatedAt: { updatedAt: sortDir },
  };

  const requestWhere = {
    ...(filters.status && ALL_STATUSES.includes(filters.status as RequestStatus) && {
      status: filters.status as RequestStatus,
    }),
    ...(filters.q && {
      OR: [
        { title: { contains: filters.q, mode: "insensitive" as const } },
        { requestNumber: { contains: filters.q, mode: "insensitive" as const } },
        { submitter: { name: { contains: filters.q, mode: "insensitive" as const } } },
      ],
    }),
    ...((filters.dateFrom || filters.dateTo) && {
      requestDate: {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59`) }),
      },
    }),
  };

  const hasFilters = !!(filters.status || filters.q || filters.dateFrom || filters.dateTo);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      requests: {
        where: requestWhere,
        orderBy: orderByMap[sortBy],
        select: {
          id: true,
          requestNumber: true,
          type: true,
          title: true,
          amount: true,
          status: true,
          requestDate: true,
          paidAt: true,
          submitter: { select: { name: true } },
          accountingSubject: { select: { code: true, name: true } },
          finalAccountingSubject: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
        >
          <ChevronLeft size={14} />
          返回專案管理
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          <span
            className={clsx(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              PROJECT_STATUS_COLOR[project.status]
            )}
          >
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          共 {project.requests.length} 筆請款紀錄
          {hasFilters && <span className="text-gray-400">（篩選後）</span>}
        </p>
      </div>

      {/* Filters */}
      <Suspense>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-44 max-w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <FilterInput
              name="q"
              value={filters.q}
              placeholder="搜尋標題、流水編號、申請人…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <FilterSelect
            name="status"
            value={filters.status}
            label="全部狀態"
            options={ALL_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABEL[s] }))}
          />
          <FilterInput name="dateFrom" type="date" value={filters.dateFrom} />
          <span className="text-xs text-gray-400">—</span>
          <FilterInput name="dateTo" type="date" value={filters.dateTo} />
          <FilterSelect name="sortBy" value={filters.sortBy} label="排序依據" options={SORT_OPTIONS} />
          <FilterSelect name="sortDir" value={filters.sortDir} label="降冪" options={SORT_DIR_OPTIONS} />
          {hasFilters && (
            <Link
              href={`/projects/${id}/requests`}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              清除篩選
            </Link>
          )}
        </div>
      </Suspense>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {project.requests.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">
              {hasFilters ? "找不到符合條件的請款單" : "此專案尚無請款單"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">流水編號</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">類型</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">標題</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">申請人</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">金額</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">申請日期</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">申請科目</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">正式科目</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">詳情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {project.requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {req.requestNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={req.type} />
                    </td>
                    <td
                      className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate"
                      title={req.title}
                    >
                      {req.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.submitter.name}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {Number(req.amount).toLocaleString()}
                      <span className="text-xs text-gray-400 ml-0.5">元</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs tabular-nums">
                      {req.requestDate.toLocaleDateString("zh-TW")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[100px] truncate" title={req.accountingSubject ? `${req.accountingSubject.code} ${req.accountingSubject.name}` : ""}>
                      {req.accountingSubject?.code ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs max-w-[100px] truncate" title={req.finalAccountingSubject ? `${req.finalAccountingSubject.code} ${req.finalAccountingSubject.name}` : ""}>
                      {req.finalAccountingSubject ? (
                        <span className={req.finalAccountingSubject.code !== req.accountingSubject?.code ? "text-amber-600" : "text-gray-500"}>
                          {req.finalAccountingSubject.code}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/requests/${req.id}`}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        詳情 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
