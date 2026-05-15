export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR, PROJECT_VIEW_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { clsx } from "clsx";

export default async function ProjectRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!PROJECT_VIEW_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      requests: {
        orderBy: { createdAt: "desc" },
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
          <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", PROJECT_STATUS_COLOR[project.status])}>
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">共 {project.requests.length} 筆請款紀錄</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {project.requests.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">此專案尚無請款單</p>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">付款狀態</th>
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
                    <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate" title={req.title}>
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
                    <td className="px-4 py-3 text-sm">
                      {req.status === "PAID" ? (
                        <span className="text-blue-600 font-medium text-xs">
                          {req.paidAt ? req.paidAt.toLocaleDateString("zh-TW") : "已付款"}
                        </span>
                      ) : req.status === "APPROVED" ? (
                        <span className="text-amber-600 text-xs">待付款</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
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
