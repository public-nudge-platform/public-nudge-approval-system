export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import Link from "next/link";
import { Banknote, Clock, CheckCircle2 } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { FINANCE_ROLES } from "@/lib/constants";

export default async function FinancePage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!FINANCE_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const [pendingPayment, paidRequests] = await Promise.all([
    prisma.request.findMany({
      where: { status: "APPROVED" },
      orderBy: { updatedAt: "asc" },
      include: { submitter: { select: { name: true } } },
    }),
    prisma.request.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 50,
      include: { submitter: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Banknote size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">財務管理</h1>
      </div>

      {/* Pending payment */}
      <section className="space-y-3">
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
            <p className="text-gray-500 font-medium text-sm">目前沒有待付款項目</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingPayment.map((req) => (
              <Link
                key={req.id}
                href={`/requests/${req.id}`}
                className="flex items-center gap-4 bg-white rounded-xl border border-amber-200 px-5 py-4 hover:border-amber-400 hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={req.type} />
                    {req.requestNumber && (
                      <span className="font-mono text-xs text-gray-400">{req.requestNumber}</span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 mt-1">{req.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {req.submitter.name}
                  </p>
                  {req.neededBy && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      需款期限：{req.neededBy.toLocaleDateString("zh-TW")}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">
                    {Number(req.amount).toLocaleString()} 元
                  </p>
                  <StatusBadge status={req.status} />
                  <p className="text-xs text-gray-400 mt-1">點擊進入詳情頁付款</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Paid records */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-green-500" />
          <h2 className="text-sm font-semibold text-gray-700">已付款紀錄</h2>
          {paidRequests.length > 0 && (
            <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {paidRequests.length}
            </span>
          )}
        </div>

        {paidRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-400">尚無付款紀錄</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">申請單</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">申請人</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">付款方式</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">憑證編號</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">付款人</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">金額</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">付款日期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paidRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/requests/${req.id}`} className="hover:text-blue-600 transition-colors">
                        <p className="font-medium text-gray-900">{req.title}</p>
                        {req.requestNumber && (
                          <p className="font-mono text-xs text-gray-400">{req.requestNumber}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.submitter.name}</td>
                    <td className="px-4 py-3 text-gray-600">{req.paymentMethod || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{req.paymentReference || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{req.paidBy || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900 tabular-nums">
                      {Number(req.amount).toLocaleString()} 元
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">
                      {req.paidAt?.toLocaleDateString("zh-TW") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
