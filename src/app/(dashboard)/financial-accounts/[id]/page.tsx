export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getAccountDetail } from "@/lib/actions/financialAccount";
import { prisma } from "@/lib/prisma";
import { FINANCE_VIEW_ROLES, TRANSACTION_TYPE_LABEL, TRANSACTION_TYPE_COLOR } from "@/lib/constants";
import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { AddTransactionButton, EditInitialBalanceButton } from "./TransactionClient";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FilterInput } from "@/components/ui/FilterInput";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SortableHeader } from "@/components/ui/SortableHeader";

type SearchParams = {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  projectId?: string;
  keyword?: string;
  sortBy?: string;
  sortDir?: string;
};

function fmt(n: number) {
  return `NT$ ${n.toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const role = session!.user.role as UserRole;
  if (!FINANCE_VIEW_ROLES.includes(role)) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;

  const SORT_FIELDS = ["transactionDate", "type", "amount", "summary", "counterparty", "project", "accountingSubject"];
  const sortBy = SORT_FIELDS.includes(sp.sortBy ?? "") ? (sp.sortBy as string) : "transactionDate";
  const sortDir = sp.sortDir === "asc" ? "asc" : "desc";

  const [detail, projects, accountingSubjects] = await Promise.all([
    getAccountDetail(id, sp),
    prisma.project.findMany({ where: { status: { not: "CLOSED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.accountingSubject.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  if (!detail) notFound();

  const { account, transactions } = detail;
  const canWrite = ["ADMIN", "FINANCE"].includes(role);
  const monthBalance = account.monthIncome - account.monthExpense;

  const typeOptions = [
    { value: "ALL", label: "全部類型" },
    { value: "INCOME", label: "入帳" },
    { value: "EXPENSE", label: "出帳" },
  ];

  const projectOptions = [
    { value: "", label: "全部專案" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[
            { label: "首頁", href: "/dashboard" },
            { label: "資金帳戶", href: "/financial-accounts" },
            { label: account.name },
          ]}
        />
        <div className="flex items-start gap-3">
          <Link href="/financial-accounts" className="mt-0.5 text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Landmark size={18} className="text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">{account.name}</h1>
            </div>
            {(account.accountLastFive || account.bankName) && (
              <p className="text-sm text-gray-500 mt-0.5 ml-6.5">
                {account.bankName && `${account.bankName}　`}
                {account.accountLastFive && `帳號後五碼：${account.accountLastFive}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {role === "ADMIN" && (
              <EditInitialBalanceButton
                accountId={id}
                currentInitialBalance={account.initialBalance}
              />
            )}
            <AddTransactionButton
              accountId={id}
              canWrite={canWrite}
              projects={projects}
              accountingSubjects={accountingSubjects}
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">目前餘額</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmt(account.balance)}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp size={12} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">本月收入</p>
          </div>
          <p className="text-xl font-bold text-green-700">+{fmt(account.monthIncome)}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown size={12} className="text-red-600" />
            <p className="text-xs text-red-700 font-medium">本月支出</p>
          </div>
          <p className="text-xl font-bold text-red-700">-{fmt(account.monthExpense)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${monthBalance >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"}`}>
          <p className="text-xs text-gray-500 mb-1">本月淨額</p>
          <p className={`text-xl font-bold ${monthBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
            {monthBalance >= 0 ? "+" : ""}{fmt(monthBalance)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <FilterSelect name="type" options={typeOptions} value={sp.type ?? "ALL"} label="類型" />
          <FilterSelect name="projectId" options={projectOptions} value={sp.projectId ?? ""} label="全部專案" />
          <DateRangeFilter fromName="dateFrom" toName="dateTo" defaultFrom={sp.dateFrom} defaultTo={sp.dateTo} />
          <FilterInput name="keyword" value={sp.keyword ?? ""} placeholder="搜尋摘要／交易對象" />
        </div>
      </div>

      {/* Transaction table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">交易明細</p>
          <p className="text-xs text-gray-500">共 {transactions.length} 筆</p>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">尚無交易記錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <tr>
                  <SortableHeader
                    label="日期"
                    field="transactionDate"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    basePath={`/financial-accounts/${id}`}
                    searchParams={sp}
                    thClassName="px-4 py-2.5 text-left font-medium"
                  />
                  <SortableHeader
                    label="類型"
                    field="type"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    basePath={`/financial-accounts/${id}`}
                    searchParams={sp}
                    thClassName="px-4 py-2.5 text-left font-medium"
                  />
                  <SortableHeader
                    label="金額"
                    field="amount"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    basePath={`/financial-accounts/${id}`}
                    searchParams={sp}
                    align="right"
                    thClassName="px-4 py-2.5 text-right font-medium"
                  />
                  <SortableHeader
                    label="摘要"
                    field="summary"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    basePath={`/financial-accounts/${id}`}
                    searchParams={sp}
                    thClassName="px-4 py-2.5 text-left font-medium"
                  />
                  <SortableHeader
                    label="交易對象"
                    field="counterparty"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    basePath={`/financial-accounts/${id}`}
                    searchParams={sp}
                    thClassName="px-4 py-2.5 text-left font-medium hidden md:table-cell"
                  />
                  <SortableHeader
                    label="專案"
                    field="project"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    basePath={`/financial-accounts/${id}`}
                    searchParams={sp}
                    thClassName="px-4 py-2.5 text-left font-medium hidden lg:table-cell"
                  />
                  <SortableHeader
                    label="會計科目"
                    field="accountingSubject"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    basePath={`/financial-accounts/${id}`}
                    searchParams={sp}
                    thClassName="px-4 py-2.5 text-left font-medium hidden lg:table-cell"
                  />
                  <th className="px-4 py-2.5 text-left font-medium hidden xl:table-cell">關聯請款</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(tx.transactionDate).toLocaleDateString("zh-TW")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${TRANSACTION_TYPE_COLOR[tx.type] ?? "text-gray-600"}`}>
                        {TRANSACTION_TYPE_LABEL[tx.type] ?? tx.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${tx.type === "INCOME" ? "text-green-700" : "text-red-700"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}{fmt(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[160px] truncate">
                      <span title={tx.summary}>{tx.summary}</span>
                      {tx.note && <p className="text-xs text-gray-400 truncate">{tx.note}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{tx.counterparty ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {tx.project ? tx.project.name : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {tx.accountingSubject ? `${tx.accountingSubject.code} ${tx.accountingSubject.name}` : "-"}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {tx.request ? (
                        <Link href={`/requests/${tx.request.id}`} className="text-blue-600 hover:underline text-xs">
                          {tx.request.requestNumber ?? tx.request.id.slice(0, 8)}
                        </Link>
                      ) : "-"}
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
