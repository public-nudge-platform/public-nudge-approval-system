export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import Link from "next/link";
import { PlusCircle, Search } from "lucide-react";
import type { RequestStatus, RequestType, UserRole } from "@prisma/client";
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from "@/lib/constants";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Suspense } from "react";

type SearchParams = {
  status?: string;
  type?: string;
  q?: string;
};

const ALL_STATUSES = Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[];
const ALL_TYPES = Object.keys(REQUEST_TYPE_LABEL) as RequestType[];

async function getRequests(userId: string, role: UserRole, params: SearchParams) {
  const isAdmin = role === "ADMIN";
  const isApprover = ["PRESIDENT", "FOUNDER_AGENT"].includes(role);

  const where = {
    ...((!isAdmin && !isApprover) && { submitterId: userId }),
    ...(params.status && ALL_STATUSES.includes(params.status as RequestStatus) && { status: params.status as RequestStatus }),
    ...(params.type && ALL_TYPES.includes(params.type as RequestType) && { type: params.type as RequestType }),
    ...(params.q && {
      OR: [
        { title: { contains: params.q, mode: "insensitive" as const } },
        { requestNumber: { contains: params.q, mode: "insensitive" as const } },
        { projectName: { contains: params.q, mode: "insensitive" as const } },
      ],
    }),
  };

  return prisma.request.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { submitter: { select: { name: true, department: true } } },
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
  const requests = await getRequests(session!.user.id, role, params);

  const canCreate = ["APPLICANT", "ADMIN", "FINANCE"].includes(role);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">請款單管理</h1>
        {canCreate && (
          <Link
            href="/requests/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle size={15} />
            新增申請單
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex-1 min-w-52 max-w-72 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="搜尋標題、編號、專案…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <Suspense>
          <div className="flex items-center gap-2">
            <FilterSelect name="status" value={params.status} label="全部狀態" options={
              ALL_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABEL[s] }))
            } />
            <FilterSelect name="type" value={params.type} label="全部類型" options={
              ALL_TYPES.map((t) => ({ value: t, label: REQUEST_TYPE_LABEL[t] }))
            } />
          </div>
        </Suspense>

        {(params.status || params.type || params.q) && (
          <Link href="/requests" className="text-xs text-gray-400 hover:text-gray-600 underline">
            清除篩選
          </Link>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <Search size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              {params.q || params.status || params.type ? "找不到符合條件的申請單" : "尚無申請單"}
            </p>
            {canCreate && !params.q && !params.status && !params.type && (
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">編號</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">標題</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">類型</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">申請人</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">金額</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">日期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400">
                        {req.requestNumber ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/requests/${req.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {req.title}
                      </Link>
                      {req.projectName && (
                        <p className="text-xs text-gray-400 mt-0.5">{req.projectName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={req.type} /></td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{req.submitter.name}</span>
                      {req.submitter.department && (
                        <span className="text-xs text-gray-400 ml-1">· {req.submitter.department}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900 tabular-nums">
                        {Number(req.amount).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400 ml-0.5">元</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">
                      {req.createdAt.toLocaleDateString("zh-TW")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">共 {requests.length} 筆</p>
    </div>
  );
}
