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
import { BarChart3, Download } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchParams = {
  type?: string;
  preview?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
  asOf?: string;
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

const inputCls =
  "block text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function TypeTabs({ current }: { current: string }) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
      {(
        [
          { value: "income-expense", label: "收支表" },
          { value: "balance-sheet", label: "資產負債表" },
        ] as const
      ).map((t) => (
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

// ─── Filter forms ─────────────────────────────────────────────────────────────

function IncomeExpenseForm({
  params,
  projects,
}: {
  params: SearchParams;
  projects: { id: string; name: string }[];
}) {
  return (
    <form
      method="get"
      action="/reports"
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
    >
      <input type="hidden" name="type" value="income-expense" />
      <input type="hidden" name="preview" value="1" />
      <h2 className="text-sm font-semibold text-gray-700">查詢條件</h2>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">月份</label>
          <input type="month" name="month" defaultValue={params.month ?? ""} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            日期區間（優先於月份）
          </label>
          <div className="flex items-center gap-1.5">
            <input type="date" name="startDate" defaultValue={params.startDate ?? ""} className={inputCls} />
            <span className="text-xs text-gray-500">—</span>
            <input type="date" name="endDate" defaultValue={params.endDate ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">專案（可不選）</label>
          <select name="projectId" defaultValue={params.projectId ?? ""} className={inputCls}>
            <option value="">全部專案</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        產生預覽
      </button>
    </form>
  );
}

function BalanceSheetForm({ params }: { params: SearchParams }) {
  return (
    <form
      method="get"
      action="/reports"
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
    >
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
          className={inputCls}
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        產生預覽
      </button>
    </form>
  );
}

// ─── Report wrapper (document-like frame) ────────────────────────────────────

function ReportFrame({
  exportUrl,
  wide,
  children,
}: {
  exportUrl: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {/* action bar above the report */}
      <div className="flex justify-end">
        <a
          href={exportUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Download size={14} />
          匯出 Excel
        </a>
      </div>
      {/* document container */}
      <div
        className={`bg-white shadow border border-gray-300 text-gray-900 mx-auto ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
        style={{ fontFamily: "sans-serif", fontSize: "13px", lineHeight: "1.4" }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Income / Expense Statement ───────────────────────────────────────────────

function IncomeExpensePreview({
  data,
  exportUrl,
}: {
  data: IncomeExpenseStatement;
  exportUrl: string;
}) {
  const pct = (n: number) =>
    data.incomeTotal > 0
      ? `${((Math.abs(n) / data.incomeTotal) * 100).toFixed(2)}%`
      : "—";

  // shared cell styles
  const tdCode = "py-[3px] text-center font-mono text-xs text-gray-500 w-20";
  const tdName = "py-[3px] px-2";
  const tdAmt  = "py-[3px] text-right tabular-nums pr-3 w-28";
  const tdPct  = "py-[3px] text-right pr-3 w-16";

  return (
    <ReportFrame exportUrl={exportUrl}>
      {/* Title block */}
      <div className="relative text-center py-4 border-b border-gray-400 px-6">
        <p className="font-bold text-[15px]">公民幫推</p>
        <p className="font-bold text-[13px]">
          {data.projectName ? `專案收支表 — ${data.projectName}` : "收支表"}
        </p>
        <p className="text-[12px] text-gray-700">
          {formatDateDisplay(data.periodFrom)}～　{formatDateDisplay(data.periodTo)}
        </p>
        <span className="absolute right-3 bottom-2 text-[11px] text-gray-600">
          幣別：新台幣
        </span>
      </div>

      {/* Table */}
      <table className="w-full border-collapse" style={{ fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #555" }}>
            <th className="py-1.5 text-center font-semibold w-20">項目代號</th>
            <th className="py-1.5 text-left font-semibold px-2">項目名稱</th>
            <th className="py-1.5 text-right font-semibold pr-3 w-28">金額</th>
            <th className="py-1.5 text-right font-semibold pr-3 w-16">%</th>
          </tr>
        </thead>
        <tbody>
          {/* ── 收入 ── */}
          <tr>
            <td className={tdCode} />
            <td className={`${tdName} font-bold pt-2`}>收入</td>
            <td /><td />
          </tr>

          {data.incomeItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-1 px-8 text-xs text-gray-400">（本期無收入）</td>
            </tr>
          ) : (
            data.incomeItems.map((item) => (
              <tr key={item.code}>
                <td className={tdCode}>{item.code}</td>
                <td className={`${tdName} pl-8`}>{item.name}</td>
                <td className={tdAmt}>{formatAmount(item.amount)}</td>
                <td className={tdPct}>{pct(item.amount)}</td>
              </tr>
            ))
          )}

          {/* 收入合計 */}
          <tr className="font-bold">
            <td className={tdCode} />
            <td className={tdName}>收入合計</td>
            <td className={tdAmt} style={{ borderBottom: "1px solid #666" }}>
              {formatAmount(data.incomeTotal)}
            </td>
            <td className={tdPct} style={{ borderBottom: "1px solid #666" }}>
              {data.incomeTotal > 0 ? "100.00%" : "—"}
            </td>
          </tr>

          {/* spacer */}
          <tr><td colSpan={4} className="py-1.5" /></tr>

          {/* ── 支出 ── */}
          <tr>
            <td className={tdCode} />
            <td className={`${tdName} font-bold`}>支出</td>
            <td /><td />
          </tr>

          {data.expenseGroups.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-1 px-8 text-xs text-gray-400">（本期無支出）</td>
            </tr>
          ) : (
            data.expenseGroups.map((group) => (
              <>
                <tr key={`gh-${group.groupName}`}>
                  <td className={tdCode} />
                  <td className={`${tdName} pl-5 font-bold`}>{group.groupName}</td>
                  <td /><td />
                </tr>
                {group.items.map((item) => (
                  <tr key={item.code}>
                    <td className={tdCode}>{item.code}</td>
                    <td className={`${tdName} pl-9`}>{item.name}</td>
                    <td className={tdAmt}>{formatAmount(item.amount)}</td>
                    <td className={tdPct}>{pct(item.amount)}</td>
                  </tr>
                ))}
                <tr key={`gs-${group.groupName}`} className="font-bold">
                  <td className={tdCode} />
                  <td className={`${tdName} pl-5`}>{group.groupName}合計</td>
                  <td className={tdAmt} style={{ borderBottom: "1px solid #666" }}>
                    {formatAmount(group.subtotal)}
                  </td>
                  <td className={tdPct} style={{ borderBottom: "1px solid #666" }}>
                    {pct(group.subtotal)}
                  </td>
                </tr>
                <tr key={`sp-${group.groupName}`}><td colSpan={4} className="py-1" /></tr>
              </>
            ))
          )}

          {/* 支出合計 */}
          <tr className="font-bold">
            <td className={tdCode} />
            <td className={tdName}>支出合計</td>
            <td className={tdAmt} style={{ borderBottom: "2px solid #333" }}>
              {formatAmount(data.expenseTotal)}
            </td>
            <td className={tdPct} style={{ borderBottom: "2px solid #333" }}>
              {pct(data.expenseTotal)}
            </td>
          </tr>

          <tr><td colSpan={4} className="py-1.5" /></tr>

          {/* 本期餘絀 */}
          <tr className="font-bold">
            <td className={tdCode} />
            <td className={`${tdName} text-[14px]`}>本期餘絀</td>
            <td
              className={`${tdAmt} text-[14px]`}
              style={{ borderBottom: "2px solid #111" }}
            >
              {formatAmount(data.netSurplus)}
            </td>
            <td className={tdPct} style={{ borderBottom: "2px solid #111" }}>
              {pct(data.netSurplus)}
            </td>
          </tr>

          <tr><td colSpan={4} className="py-3" /></tr>
        </tbody>
      </table>
    </ReportFrame>
  );
}

// ─── Balance Sheet Preview ────────────────────────────────────────────────────

function BalanceSheetPreview({
  data,
  exportUrl,
}: {
  data: BalanceSheet;
  exportUrl: string;
}) {
  const tdCode = "py-[3px] text-center font-mono text-xs text-gray-500 w-16";
  const tdName = "py-[3px] px-2";
  const tdAmt  = "py-[3px] text-right tabular-nums pr-2 w-24";

  return (
    <ReportFrame exportUrl={exportUrl} wide>
      {/* Title block */}
      <div className="relative text-center py-4 border-b border-gray-400 px-6">
        <p className="font-bold text-[15px]">公民幫推</p>
        <p className="font-bold text-[13px]">資產負債表</p>
        <p className="text-[12px] text-gray-700">{formatDateDisplay(data.asOf)}</p>
        <span className="absolute right-3 bottom-2 text-[11px] text-gray-600">幣別：新台幣</span>
      </div>

      <p className="text-center text-[11px] text-gray-400 py-0.5 border-b border-gray-200">
        系統管理用簡化資產負債表
      </p>

      {!data.balanced && (
        <div className="px-4 py-1.5 border-b border-amber-300 bg-amber-50 text-[11px] text-amber-700">
          ⚠ 資產總額與負債＋基金暨餘絀總額不相等，可能是尚未輸入累計餘絀（期初帳）。
        </div>
      )}

      {/* Two-column table */}
      <div className="grid grid-cols-2 divide-x divide-gray-400" style={{ fontSize: "13px" }}>

        {/* ── 資產 ── */}
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "2px solid #555" }}>
              <th className="py-1.5 text-center font-semibold w-16 text-xs">項目代號</th>
              <th className="py-1.5 text-left font-semibold px-2 text-xs">項目名稱</th>
              <th className="py-1.5 text-right font-semibold pr-2 w-24 text-xs">金額</th>
            </tr>
          </thead>
          <tbody>
            {/* 流動資產 */}
            <tr>
              <td /><td className={`${tdName} font-bold pt-2`}>流動資產</td><td />
            </tr>
            {data.cashAccounts.map((acc) => (
              <tr key={acc.accountId}>
                <td className={tdCode}>{acc.code}</td>
                <td className={`${tdName} pl-5`}>{acc.name}</td>
                <td className={tdAmt}>{formatAmount(acc.balance)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td />
              <td className={tdName}>現金合計</td>
              <td className={tdAmt} style={{ borderBottom: "1px solid #555" }}>
                {formatAmount(data.cashTotal)}
              </td>
            </tr>
            <tr>
              <td className={tdCode}>1230</td>
              <td className={`${tdName} pl-5`}>應收款項</td>
              <td className={tdAmt}>{formatAmount(data.receivables)}</td>
            </tr>
            <tr>
              <td className={tdCode}>1250</td>
              <td className={`${tdName} pl-5`}>預付款項</td>
              <td className={tdAmt}>{formatAmount(data.prepaid)}</td>
            </tr>
            <tr className="font-bold">
              <td />
              <td className={tdName}>流動資產合計</td>
              <td className={tdAmt} style={{ borderBottom: "1px solid #555" }}>
                {formatAmount(data.currentAssetsTotal)}
              </td>
            </tr>
            <tr><td colSpan={3} className="py-2" /></tr>
            <tr><td colSpan={3} className="py-1" /></tr>
            <tr className="font-bold">
              <td />
              <td className={`${tdName} text-[14px]`}>資產總額</td>
              <td className={`${tdAmt} text-[14px]`} style={{ borderBottom: "2px solid #111" }}>
                {formatAmount(data.assetsTotal)}
              </td>
            </tr>
            <tr><td colSpan={3} className="py-2" /></tr>
          </tbody>
        </table>

        {/* ── 負債及基金 ── */}
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "2px solid #555" }}>
              <th className="py-1.5 text-center font-semibold w-16 text-xs">項目代號</th>
              <th className="py-1.5 text-left font-semibold px-2 text-xs">項目名稱</th>
              <th className="py-1.5 text-right font-semibold pr-2 w-24 text-xs">金額</th>
            </tr>
          </thead>
          <tbody>
            {/* 流動負債 */}
            <tr>
              <td /><td className={`${tdName} font-bold pt-2`}>流動負債</td><td />
            </tr>
            <tr>
              <td className={tdCode}>2130</td>
              <td className={`${tdName} pl-5`}>應付款項</td>
              <td className={tdAmt}>{formatAmount(data.payables)}</td>
            </tr>
            <tr>
              <td className={tdCode}>2150</td>
              <td className={`${tdName} pl-5`}>預收款項</td>
              <td className={tdAmt}>{formatAmount(data.preReceived)}</td>
            </tr>
            <tr className="font-bold">
              <td />
              <td className={tdName}>流動負債合計</td>
              <td className={tdAmt} style={{ borderBottom: "1px solid #555" }}>
                {formatAmount(data.currentLiabilitiesTotal)}
              </td>
            </tr>
            <tr><td colSpan={3} className="py-0.5" /></tr>
            <tr className="font-bold">
              <td />
              <td className={tdName}>負債總額</td>
              <td className={tdAmt} style={{ borderBottom: "1px solid #555" }}>
                {formatAmount(data.liabilitiesTotal)}
              </td>
            </tr>
            <tr><td colSpan={3} className="py-1" /></tr>

            {/* 基金暨餘絀 */}
            <tr>
              <td /><td className={`${tdName} font-bold`}>基金暨餘絀</td><td />
            </tr>
            <tr>
              <td className={tdCode}>3210</td>
              <td className={`${tdName} pl-5`}>累計餘絀</td>
              <td className={tdAmt}>{formatAmount(data.accumulatedSurplus)}</td>
            </tr>
            <tr>
              <td className={tdCode}>3440</td>
              <td className={`${tdName} pl-5`}>本期餘絀</td>
              <td className={tdAmt}>{formatAmount(data.currentSurplus)}</td>
            </tr>
            <tr className="font-bold">
              <td />
              <td className={tdName}>基金暨餘絀總額</td>
              <td className={tdAmt} style={{ borderBottom: "1px solid #555" }}>
                {formatAmount(data.fundTotal)}
              </td>
            </tr>
            <tr><td colSpan={3} className="py-0.5" /></tr>
            <tr className="font-bold">
              <td />
              <td className={`${tdName} text-[14px]`}>負債、基金暨餘絀總額</td>
              <td
                className={`${tdAmt} text-[14px] ${!data.balanced ? "text-amber-700" : ""}`}
                style={{ borderBottom: "2px solid #111" }}
              >
                {formatAmount(data.liabilitiesAndFundTotal)}
              </td>
            </tr>
            <tr><td colSpan={3} className="py-2" /></tr>
          </tbody>
        </table>
      </div>
    </ReportFrame>
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
      const period = parsePeriodParams({ month: p.month, startDate: p.startDate, endDate: p.endDate });
      if (!period) {
        previewError = "請輸入月份或日期區間";
      } else {
        incomeExpenseData = await generateIncomeExpenseStatement({
          from: period.from,
          to: period.to,
          projectId: p.projectId || undefined,
        });
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
        balanceSheetData = await generateBalanceSheet({ asOf: new Date(`${p.asOf}T23:59:59`) });
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
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">財務報表</h1>
      </div>

      <TypeTabs current={reportType} />

      {reportType === "income-expense" ? (
        <IncomeExpenseForm params={p} projects={projects} />
      ) : (
        <BalanceSheetForm params={p} />
      )}

      {showPreview && previewError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          {previewError}
        </div>
      )}

      {incomeExpenseData && (
        <IncomeExpensePreview data={incomeExpenseData} exportUrl={incomeExportUrl} />
      )}

      {balanceSheetData && (
        <BalanceSheetPreview data={balanceSheetData} exportUrl={balanceExportUrl} />
      )}
    </div>
  );
}
