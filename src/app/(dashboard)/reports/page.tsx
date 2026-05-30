export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FINANCE_ROLES } from "@/lib/constants";
import { logAuditAction } from "@/lib/audit";
import {
  generateIncomeExpenseStatement,
  generateBalanceSheet,
  parsePeriodParams,
  formatDateDisplay,
  formatAmount,
  type IncomeExpenseStatement,
  type BalanceSheet,
} from "@/lib/reports";
import type { UserRole } from "@prisma/client";
import { BarChart3, Download, ArrowLeft } from "lucide-react";

// ─── Param types ─────────────────────────────────────────────────────────────

type SearchParams = {
  type?: string;       // "income-expense" | "balance-sheet"
  preview?: string;    // "1"
  month?: string;      // YYYY-MM
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  projectId?: string;
  asOf?: string;       // YYYY-MM-DD
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildExportUrl(base: string, p: SearchParams): string {
  const qs = new URLSearchParams();
  if (p.month) qs.set("month", p.month);
  if (p.startDate) qs.set("startDate", p.startDate);
  if (p.endDate) qs.set("endDate", p.endDate);
  if (p.projectId) qs.set("projectId", p.projectId);
  if (p.asOf) qs.set("asOf", p.asOf);
  return `${base}?${qs.toString()}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypeTabs({ current }: { current: string }) {
  const tabs = [
    { value: "income-expense", label: "收支表" },
    { value: "balance-sheet", label: "資產負債表" },
  ];
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
      {tabs.map((t) => (
        <a
          key={t.value}
          href={`/reports?type=${t.value}`}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            current === t.value
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}

function IncomeExpenseForm({
  params,
  projects,
}: {
  params: SearchParams;
  projects: { id: string; name: string }[];
}) {
  return (
    <form method="get" action="/reports" className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <input type="hidden" name="type" value="income-expense" />
      <input type="hidden" name="preview" value="1" />

      <h2 className="text-sm font-semibold text-gray-700">查詢條件</h2>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">月份</label>
          <input
            type="month"
            name="month"
            defaultValue={params.month ?? ""}
            className="block text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">日期區間（優先於月份）</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                name="startDate"
                defaultValue={params.startDate ?? ""}
                className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-xs text-gray-500">—</span>
              <input
                type="date"
                name="endDate"
                defaultValue={params.endDate ?? ""}
                className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">專案（可不選）</label>
          <select
            name="projectId"
            defaultValue={params.projectId ?? ""}
            className="block text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部專案</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        產生預覽
      </button>
    </form>
  );
}

function BalanceSheetForm({ params }: { params: SearchParams }) {
  return (
    <form method="get" action="/reports" className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <input type="hidden" name="type" value="balance-sheet" />
      <input type="hidden" name="preview" value="1" />

      <h2 className="text-sm font-semibold text-gray-700">查詢條件</h2>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">截至日期</label>
        <input
          type="date"
          name="asOf"
          required
          defaultValue={params.asOf ?? ""}
          className="block text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        產生預覽
      </button>
    </form>
  );
}

// ─── Preview: Income/Expense Statement ───────────────────────────────────────

function IncomeExpensePreview({
  data,
  exportUrl,
}: {
  data: IncomeExpenseStatement;
  exportUrl: string;
}) {
  const pct = (amt: number) =>
    data.incomeTotal > 0
      ? `${((amt / data.incomeTotal) * 100).toFixed(1)}%`
      : "—";

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Preview header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">預覽</p>
          <p className="text-sm font-semibold text-gray-800">
            {data.projectName ? `專案收支表 — ${data.projectName}` : "收支表"}
          </p>
          <p className="text-xs text-gray-500">
            期間：{formatDateDisplay(data.periodFrom)} ～ {formatDateDisplay(data.periodTo)}
          </p>
        </div>
        <a
          href={exportUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Download size={14} />
          匯出 Excel
        </a>
      </div>

      {/* Report table */}
      <div className="px-6 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-24">項目代號</th>
              <th className="text-left pb-2 text-xs font-semibold text-gray-500">項目名稱</th>
              <th className="text-right pb-2 text-xs font-semibold text-gray-500 w-32">金額（元）</th>
              <th className="text-right pb-2 text-xs font-semibold text-gray-500 w-20">%</th>
            </tr>
          </thead>
          <tbody>
            {/* Income section */}
            <tr>
              <td colSpan={4} className="pt-4 pb-1">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">收入</span>
              </td>
            </tr>

            {data.incomeItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-2 text-xs text-gray-400 pl-4">（本期無收入）</td>
              </tr>
            ) : (
              data.incomeItems.map((item) => (
                <tr key={item.code} className="hover:bg-gray-50">
                  <td className="py-1.5 pl-4 font-mono text-xs text-gray-500">{item.code}</td>
                  <td className="py-1.5 text-gray-800">{item.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{formatAmount(item.amount)}</td>
                  <td className="py-1.5 text-right text-gray-500 text-xs">{pct(item.amount)}</td>
                </tr>
              ))
            )}

            <tr className="border-t border-gray-200 bg-blue-50">
              <td className="py-2 pl-4 font-mono text-xs text-gray-500"></td>
              <td className="py-2 font-semibold text-gray-800">收入合計</td>
              <td className="py-2 text-right tabular-nums font-bold text-blue-700">{formatAmount(data.incomeTotal)}</td>
              <td className="py-2 text-right text-gray-500 text-xs">{data.incomeTotal > 0 ? "100.0%" : "—"}</td>
            </tr>

            {/* Expense section */}
            <tr>
              <td colSpan={4} className="pt-5 pb-1">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">支出</span>
              </td>
            </tr>

            {data.expenseGroups.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-2 text-xs text-gray-400 pl-4">（本期無支出）</td>
              </tr>
            ) : (
              data.expenseGroups.map((group) => (
                <>
                  <tr key={`g-${group.groupName}`}>
                    <td colSpan={4} className="pt-3 pb-0.5 pl-2">
                      <span className="text-xs font-semibold text-gray-600">{group.groupName}</span>
                    </td>
                  </tr>
                  {group.items.map((item) => (
                    <tr key={item.code} className="hover:bg-gray-50">
                      <td className="py-1.5 pl-6 font-mono text-xs text-gray-500">{item.code}</td>
                      <td className="py-1.5 text-gray-800">{item.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-900">{formatAmount(item.amount)}</td>
                      <td className="py-1.5 text-right text-gray-500 text-xs">{pct(item.amount)}</td>
                    </tr>
                  ))}
                  <tr key={`st-${group.groupName}`} className="border-t border-dashed border-gray-200">
                    <td className="py-1 pl-4 text-xs text-gray-500"></td>
                    <td className="py-1 text-xs font-medium text-gray-600">{group.groupName}合計</td>
                    <td className="py-1 text-right tabular-nums text-sm font-medium text-gray-700">{formatAmount(group.subtotal)}</td>
                    <td className="py-1 text-right text-xs text-gray-500">{pct(group.subtotal)}</td>
                  </tr>
                </>
              ))
            )}

            <tr className="border-t border-gray-200 bg-red-50">
              <td className="py-2 pl-4 font-mono text-xs text-gray-500"></td>
              <td className="py-2 font-semibold text-gray-800">支出合計</td>
              <td className="py-2 text-right tabular-nums font-bold text-red-700">{formatAmount(data.expenseTotal)}</td>
              <td className="py-2 text-right text-xs text-gray-500">{pct(data.expenseTotal)}</td>
            </tr>

            {/* Net surplus */}
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-3 pl-4 font-mono text-xs text-gray-500"></td>
              <td className="py-3 font-bold text-gray-900">本期餘絀</td>
              <td
                className={`py-3 text-right tabular-nums font-bold text-lg ${
                  data.netSurplus >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {data.netSurplus >= 0 ? "" : "−"}
                {formatAmount(Math.abs(data.netSurplus))}
              </td>
              <td className="py-3 text-right text-xs text-gray-500">{pct(data.netSurplus)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Preview: Balance Sheet ───────────────────────────────────────────────────

function BalanceSheetPreview({
  data,
  exportUrl,
}: {
  data: BalanceSheet;
  exportUrl: string;
}) {
  const Row = ({
    code,
    name,
    amount,
    bold = false,
    indent = false,
  }: {
    code?: string;
    name: string;
    amount: number | string;
    bold?: boolean;
    indent?: boolean;
  }) => (
    <tr className={bold ? "bg-gray-50 border-t border-gray-200" : "hover:bg-gray-50"}>
      <td className={`py-1.5 font-mono text-xs text-gray-400 ${indent ? "pl-6" : "pl-4"}`}>
        {code ?? ""}
      </td>
      <td className={`py-1.5 ${bold ? "font-semibold text-gray-800" : "text-gray-700"}`}>
        {name}
      </td>
      <td className={`py-1.5 text-right tabular-nums ${bold ? "font-bold text-gray-900" : "text-gray-800"}`}>
        {typeof amount === "number" ? formatAmount(amount) : amount}
      </td>
    </tr>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <tr>
      <td colSpan={3} className="pt-4 pb-1 pl-2">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{title}</span>
      </td>
    </tr>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Preview header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">預覽 — 系統管理用簡化資產負債表</p>
          <p className="text-sm font-semibold text-gray-800">資產負債表</p>
          <p className="text-xs text-gray-500">截至：{formatDateDisplay(data.asOf)}</p>
        </div>
        <a
          href={exportUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Download size={14} />
          匯出 Excel
        </a>
      </div>

      {!data.balanced && (
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          ⚠ 資產總額與負債＋基金暨餘絀總額不相等，可能是系統資料尚不完整（例如尚未輸入期初帳）。
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        {/* Assets column */}
        <div className="px-4 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-16">代號</th>
                <th className="text-left pb-2 text-xs font-semibold text-gray-500">項目名稱</th>
                <th className="text-right pb-2 text-xs font-semibold text-gray-500 w-28">金額（元）</th>
              </tr>
            </thead>
            <tbody>
              <SectionHeader title="資產" />
              <SectionHeader title="流動資產" />

              {/* Cash accounts */}
              {data.cashAccounts.map((acc) => (
                <Row key={acc.accountId} code={acc.code} name={acc.name} amount={acc.balance} indent />
              ))}
              <Row name="現金及銀行存款合計" amount={data.cashTotal} bold />

              {data.receivables > 0 && (
                <Row code="1230" name="應收款項" amount={data.receivables} indent />
              )}
              {data.prepaid > 0 && (
                <Row code="1250" name="預付款項" amount={data.prepaid} indent />
              )}

              <Row name="流動資產合計" amount={data.currentAssetsTotal} bold />
              <tr className="border-t-2 border-gray-300">
                <td className="py-2 pl-4 font-mono text-xs text-gray-400"></td>
                <td className="py-2 font-bold text-gray-900">資產總額</td>
                <td className="py-2 text-right tabular-nums font-bold text-lg text-gray-900">
                  {formatAmount(data.assetsTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Liabilities + Fund column */}
        <div className="px-4 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-16">代號</th>
                <th className="text-left pb-2 text-xs font-semibold text-gray-500">項目名稱</th>
                <th className="text-right pb-2 text-xs font-semibold text-gray-500 w-28">金額（元）</th>
              </tr>
            </thead>
            <tbody>
              <SectionHeader title="負債" />
              <SectionHeader title="流動負債" />

              {data.payables > 0 ? (
                <Row code="2130" name="應付款項" amount={data.payables} indent />
              ) : (
                <Row code="2130" name="應付款項" amount={0} indent />
              )}
              {data.preReceived > 0 && (
                <Row code="2150" name="預收款項" amount={data.preReceived} indent />
              )}

              <Row name="流動負債合計" amount={data.currentLiabilitiesTotal} bold />
              <Row name="負債總額" amount={data.liabilitiesTotal} bold />

              <SectionHeader title="基金暨餘絀" />
              <Row code="3210" name="累計餘絀" amount={data.accumulatedSurplus} indent />
              <Row code="3440" name="本期餘絀" amount={data.currentSurplus} indent />
              <Row name="基金暨餘絀總額" amount={data.fundTotal} bold />

              <tr className="border-t-2 border-gray-300">
                <td className="py-2 pl-4 font-mono text-xs text-gray-400"></td>
                <td className="py-2 font-bold text-gray-900">負債、基金暨餘絀總額</td>
                <td
                  className={`py-2 text-right tabular-nums font-bold text-lg ${
                    data.balanced ? "text-gray-900" : "text-amber-700"
                  }`}
                >
                  {formatAmount(data.liabilitiesAndFundTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role)) redirect("/dashboard");

  const p = await searchParams;
  const reportType = p.type === "balance-sheet" ? "balance-sheet" : "income-expense";
  const showPreview = p.preview === "1";

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let incomeExpenseData: IncomeExpenseStatement | null = null;
  let balanceSheetData: BalanceSheet | null = null;
  let previewError: string | null = null;

  if (showPreview) {
    if (reportType === "income-expense") {
      const period = parsePeriodParams({
        month: p.month,
        startDate: p.startDate,
        endDate: p.endDate,
      });
      if (!period) {
        previewError = "請輸入月份或日期區間";
      } else {
        incomeExpenseData = await generateIncomeExpenseStatement({
          from: period.from,
          to: period.to,
          projectId: p.projectId || undefined,
        });
        // Audit log
        void logAuditAction({
          userId: session.user.id,
          userName: session.user.name ?? session.user.email ?? "unknown",
          action: "DATA_EXPORTED",
          entityType: "Report",
          description: `產生收支表預覽，期間 ${formatDateDisplay(period.from)}～${formatDateDisplay(period.to)}${incomeExpenseData.projectName ? `，專案：${incomeExpenseData.projectName}` : ""}`,
          afterData: {
            reportType: "income-expense",
            from: period.from.toISOString(),
            to: period.to.toISOString(),
            projectId: p.projectId ?? null,
            incomeTotal: incomeExpenseData.incomeTotal,
            expenseTotal: incomeExpenseData.expenseTotal,
          },
        });
      }
    } else {
      if (!p.asOf) {
        previewError = "請選擇截至日期";
      } else {
        balanceSheetData = await generateBalanceSheet({
          asOf: new Date(`${p.asOf}T23:59:59`),
        });
        void logAuditAction({
          userId: session.user.id,
          userName: session.user.name ?? session.user.email ?? "unknown",
          action: "DATA_EXPORTED",
          entityType: "Report",
          description: `產生資產負債表預覽，截至 ${p.asOf}`,
          afterData: {
            reportType: "balance-sheet",
            asOf: p.asOf,
            assetsTotal: balanceSheetData.assetsTotal,
            balanced: balanceSheetData.balanced,
          },
        });
      }
    }
  }

  const incomeExportUrl = buildExportUrl("/api/export/reports/income-expense", p);
  const balanceExportUrl = buildExportUrl("/api/export/reports/balance-sheet", p);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">財務報表</h1>
      </div>

      {/* Type tabs */}
      <TypeTabs current={reportType} />

      {/* Filter form */}
      {reportType === "income-expense" ? (
        <IncomeExpenseForm params={p} projects={projects} />
      ) : (
        <BalanceSheetForm params={p} />
      )}

      {/* Error */}
      {showPreview && previewError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          {previewError}
        </div>
      )}

      {/* Preview: Income/Expense */}
      {incomeExpenseData && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <ArrowLeft size={12} />
            修改條件後重新按「產生預覽」即可更新
          </div>
          <IncomeExpensePreview
            data={incomeExpenseData}
            exportUrl={incomeExportUrl}
          />
        </div>
      )}

      {/* Preview: Balance Sheet */}
      {balanceSheetData && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <ArrowLeft size={12} />
            修改截至日期後重新按「產生預覽」即可更新
          </div>
          <BalanceSheetPreview
            data={balanceSheetData}
            exportUrl={balanceExportUrl}
          />
        </div>
      )}
    </div>
  );
}
