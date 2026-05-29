export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFinancialAccounts } from "@/lib/actions/financialAccount";
import Link from "next/link";
import { FINANCE_VIEW_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";
import { Landmark, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

function fmt(n: number) {
  return `NT$ ${n.toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function FinancialAccountsPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!FINANCE_VIEW_ROLES.includes(role)) redirect("/dashboard");

  const accounts = await getFinancialAccounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">資金帳戶</h1>
        <p className="text-sm text-gray-500 mt-0.5">協會資金帳戶餘額與入出帳明細</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Landmark size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{acc.name}</p>
                  {acc.accountLastFive && (
                    <p className="text-xs text-gray-500">帳號後五碼：{acc.accountLastFive}</p>
                  )}
                  {acc.bankName && (
                    <p className="text-xs text-gray-500">{acc.bankName}</p>
                  )}
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
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{fmt(acc.balance)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingUp size={12} className="text-green-600" />
                  <p className="text-xs text-green-700 font-medium">本月收入</p>
                </div>
                <p className="text-sm font-semibold text-green-700">+{fmt(acc.monthIncome)}</p>
              </div>
              <div className="bg-red-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingDown size={12} className="text-red-600" />
                  <p className="text-xs text-red-700 font-medium">本月支出</p>
                </div>
                <p className="text-sm font-semibold text-red-700">-{fmt(acc.monthExpense)}</p>
              </div>
            </div>

            {acc.lastTransaction && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 mb-1">最近交易</p>
                <p className="text-xs text-gray-700">
                  {new Date(acc.lastTransaction.date).toLocaleDateString("zh-TW")}
                  {" "}
                  <span className={acc.lastTransaction.type === "INCOME" ? "text-green-600" : "text-red-600"}>
                    {acc.lastTransaction.type === "INCOME" ? "入帳" : "出帳"}
                  </span>
                  {" "}{acc.lastTransaction.summary}{" "}
                  <span className="font-medium">{fmt(acc.lastTransaction.amount)}</span>
                </p>
              </div>
            )}
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400 text-sm">尚無資金帳戶資料</div>
        )}
      </div>
    </div>
  );
}
