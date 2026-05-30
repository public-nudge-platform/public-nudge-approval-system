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

// ─── Param types ─────────────────────────────────────────────────────────────

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
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
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

// ─── Report wrapper ───────────────────────────────────────────────────────────

function ReportWrapper({
  exportUrl,
  children,
}: {
  exportUrl: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <a
          href={exportUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Download size={14} />
          匯出 Excel
        </a>
      </div>
      <div className="bg-white border border-gray-400 text-sm">{children}</div>
    </div>
  );
}

// ─── Income / Expense Preview ────────────────────────────────────────────────

function IncomeExpensePreview({
  data,
  exportUrl,
}: {
  data: IncomeExpenseStatement;
  exportUrl: string;
}) {
  const pct = (n: number) =>
    data.incomeTotal > 0
      ? `${((n / data.incomeTotal) * 100).toFixed(2)}%`
      : "—";

  return (
    <ReportWrapper exportUrl={exportUrl}>
      {/* Title block */}
      <div className="relative text-center py-4 border-b border-gray-400">
        <p className="font-bold text-base leading-snug">公民幫推</p>
        <p className="font-bold leading-snug">
          {data.projectName ? `專案收支表 — ${data.projectName}` : "收支表"}
        </p>
        <p className="leading-snug">
          {formatDateDisplay(data.periodFrom)}～　{formatDateDisplay(data.periodTo)}
        </p>
        <span className="absolute right-4 bottom-3 text-xs text-gray-600">
          幣別：新台幣
        </span>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-600">
            <th className="py-2 text-center font-semibold w-24">項目代號</th>
            <th className="py-2 text-left font-semibold px-3">項目名稱</th>
            <th className="py-2 text-right font-semibold w-36 pr-4">金額</th>
            <th className="py-2 text-right font-semibold w-20 pr-3">%</th>
          </tr>
        </thead>
        <tbody>
          {/* ── 收入 ── */}
          <tr>
            <td />
            <td className="pt-3 pb-0.5 px-3 font-bold">收入</td>
            <td />
            <td />
          </tr>
          {data.incomeItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-1 pl-10 text-gray-400 text-xs">
                （本期無收入）
              </td>
            </tr>
          ) : (
            data.incomeItems.map((item) => (
              <tr key={item.code}>
                <td className="py-0.5 text-center font-mono text-xs text-gray-500">
                  {item.code}
                </td>
                <td className="py-0.5 px-3 pl-8">{item.name}</td>
                <td className="py-0.5 text-right tabular-nums pr-4">
                  {formatAmount(item.amount)}
                </td>
                <td className="py-0.5 text-right pr-3">{pct(item.amount)}</td>
              </tr>
            ))
          )}
          {/* 收入合計 */}
          <tr className="font-bold">
            <td className="pb-1" />
            <td className="py-1 px-3">收入合計</td>
            <td className="py-1 text-right tabular-nums pr-4 border-b border-gray-600">
              {formatAmount(data.incomeTotal)}
            </td>
            <td className="py-1 text-right pr-3 border-b border-gray-600">
              {pct(data.incomeTotal)}
            </td>
          </tr>

          {/* spacer */}
          <tr>
            <td colSpan={4} className="py-1" />
          </tr>

          {/* ── 支出 ── */}
          <tr>
            <td />
            <td className="pb-0.5 px-3 font-bold">支出</td>
            <td />
            <td />
          </tr>

          {data.expenseGroups.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-1 pl-10 text-gray-400 text-xs">
                （本期無支出）
              </td>
            </tr>
          ) : (
            data.expenseGroups.map((group) => (
              <>
                {/* group heading */}
                <tr key={`gh-${group.groupName}`}>
                  <td />
                  <td className="pt-1 pb-0.5 px-3 pl-6 font-bold">{group.groupName}</td>
                  <td />
                  <td />
                </tr>
                {/* group items */}
                {group.items.map((item) => (
                  <tr key={item.code}>
                    <td className="py-0.5 text-center font-mono text-xs text-gray-500">
                      {item.code}
                    </td>
                    <td className="py-0.5 px-3 pl-10">{item.name}</td>
                    <td className="py-0.5 text-right tabular-nums pr-4">
                      {formatAmount(item.amount)}
                    </td>
                    <td className="py-0.5 text-right pr-3">{pct(item.amount)}</td>
                  </tr>
                ))}
                {/* group subtotal */}
                <tr key={`gs-${group.groupName}`} className="font-bold">
                  <td className="pb-1" />
                  <td className="py-1 px-3 pl-6">{group.groupName}合計</td>
                  <td className="py-1 text-right tabular-nums pr-4 border-b border-gray-600">
                    {formatAmount(group.subtotal)}
                  </td>
                  <td className="py-1 text-right pr-3 border-b border-gray-600">
                    {pct(group.subtotal)}
                  </td>
                </tr>
                <tr key={`sp-${group.groupName}`}>
                  <td colSpan={4} className="py-1" />
                </tr>
              </>
            ))
          )}

          {/* 支出合計 */}
          <tr className="font-bold">
            <td />
            <td className="py-1 px-3">支出合計</td>
            <td className="py-1 text-right tabular-nums pr-4 border-b-2 border-gray-700">
              {formatAmount(data.expenseTotal)}
            </td>
            <td className="py-1 text-right pr-3 border-b-2 border-gray-700">
              {pct(data.expenseTotal)}
            </td>
          </tr>

          {/* spacer */}
          <tr>
            <td colSpan={4} className="py-1" />
          </tr>

          {/* 本期餘絀 */}
          <tr className="font-bold">
            <td />
            <td className="py-2 px-3 text-base">本期餘絀</td>
            <td
              className={`py-2 text-right tabular-nums text-base pr-4 border-b-2 border-gray-900 ${
                data.netSurplus < 0 ? "text-red-700" : ""
              }`}
            >
              {formatAmount(data.netSurplus)}
            </td>
            <td className="py-2 text-right pr-3 border-b-2 border-gray-900">
              {pct(data.netSurplus)}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="py-2" />
          </tr>
        </tbody>
      </table>
    </ReportWrapper>
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
  // Shared cell helpers
  const Code = ({ v }: { v?: string }) => (
    <td className="py-0.5 text-center font-mono text-xs text-gray-500 w-16">{v ?? ""}</td>
  );
  const Name = ({ v, bold, indent }: { v: string; bold?: boolean; indent?: boolean }) => (
    <td className={`py-0.5 px-2 ${bold ? "font-bold" : ""} ${indent ? "pl-6" : ""}`}>{v}</td>
  );
  const Amt = ({
    v,
    bold,
    underline,
    double,
    warn,
  }: {
    v: number;
    bold?: boolean;
    underline?: boolean;
    double?: boolean;
    warn?: boolean;
  }) => (
    <td
      className={`py-0.5 text-right tabular-nums pr-3 w-28 ${bold ? "font-bold" : ""} ${
        double ? "border-b-2 border-gray-900" : underline ? "border-b border-gray-600" : ""
      } ${warn ? "text-amber-700" : ""}`}
    >
      {formatAmount(v)}
    </td>
  );
  const Blank = ({ cols = 3 }: { cols?: number }) => (
    <tr>
      <td colSpan={cols} className="py-1" />
    </tr>
  );
  const SectionHead = ({ v }: { v: string }) => (
    <tr>
      <td />
      <td className="pt-3 pb-0.5 px-2 font-bold">{v}</td>
      <td />
    </tr>
  );

  return (
    <ReportWrapper exportUrl={exportUrl}>
      {/* Title block */}
      <div className="relative text-center py-4 border-b border-gray-400">
        <p className="font-bold text-base leading-snug">公民幫推</p>
        <p className="font-bold leading-snug">資產負債表</p>
        <p className="leading-snug">{formatDateDisplay(data.asOf)}</p>
        <span className="absolute right-4 bottom-3 text-xs text-gray-600">幣別：新台幣</span>
      </div>

      <p className="text-center text-xs text-gray-400 py-1 border-b border-gray-200">
        系統管理用簡化資產負債表
      </p>

      {!data.balanced && (
        <div className="px-4 py-2 border-b border-amber-200 bg-amber-50 text-xs text-amber-700">
          ⚠ 資產總額與負債＋基金暨餘絀總額不相等，可能是尚未輸入期初帳（累計餘絀）。
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-2 divide-x divide-gray-400">
        {/* ── Assets ── */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-600">
              <th className="py-2 text-center font-semibold text-xs w-16">項目代號</th>
              <th className="py-2 text-left font-semibold text-xs px-2">項目名稱</th>
              <th className="py-2 text-right font-semibold text-xs pr-3 w-28">金額</th>
            </tr>
          </thead>
          <tbody>
            <SectionHead v="流動資產" />
            {data.cashAccounts.map((acc) => (
              <tr key={acc.accountId}>
                <Code v={acc.code} />
                <Name v={acc.name} indent />
                <Amt v={acc.balance} />
              </tr>
            ))}
            <tr className="font-bold">
              <Code />
              <Name v="現金合計" bold />
              <Amt v={data.cashTotal} bold underline />
            </tr>
            <tr>
              <Code v="1230" />
              <Name v="應收款項" indent />
              <Amt v={data.receivables} />
            </tr>
            <tr>
              <Code v="1250" />
              <Name v="預付款項" indent />
              <Amt v={data.prepaid} />
            </tr>
            <tr className="font-bold">
              <Code />
              <Name v="流動資產合計" bold />
              <Amt v={data.currentAssetsTotal} bold underline />
            </tr>
            <Blank />
            <Blank />
            <tr className="font-bold">
              <Code />
              <Name v="資產總額" bold />
              <Amt v={data.assetsTotal} bold double />
            </tr>
            <Blank />
          </tbody>
        </table>

        {/* ── Liabilities & Fund ── */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-600">
              <th className="py-2 text-center font-semibold text-xs w-16">項目代號</th>
              <th className="py-2 text-left font-semibold text-xs px-2">項目名稱</th>
              <th className="py-2 text-right font-semibold text-xs pr-3 w-28">金額</th>
            </tr>
          </thead>
          <tbody>
            <SectionHead v="流動負債" />
            <tr>
              <Code v="2130" />
              <Name v="應付款項" indent />
              <Amt v={data.payables} />
            </tr>
            <tr>
              <Code v="2150" />
              <Name v="預收款項" indent />
              <Amt v={data.preReceived} />
            </tr>
            <tr className="font-bold">
              <Code />
              <Name v="流動負債合計" bold />
              <Amt v={data.currentLiabilitiesTotal} bold underline />
            </tr>
            <Blank />
            <tr className="font-bold">
              <Code />
              <Name v="負債總額" bold />
              <Amt v={data.liabilitiesTotal} bold underline />
            </tr>
            <Blank />
            <SectionHead v="基金暨餘絀" />
            <tr>
              <Code v="3210" />
              <Name v="累計餘絀" indent />
              <Amt v={data.accumulatedSurplus} />
            </tr>
            <tr>
              <Code v="3440" />
              <Name v="本期餘絀" indent />
              <Amt v={data.currentSurplus} />
            </tr>
            <tr className="font-bold">
              <Code />
              <Name v="基金暨餘絀總額" bold />
              <Amt v={data.fundTotal} bold underline />
            </tr>
            <Blank />
            <tr className="font-bold">
              <Code />
              <Name v="負債、基金暨餘絀總額" bold />
              <Amt v={data.liabilitiesAndFundTotal} bold double warn={!data.balanced} />
            </tr>
            <Blank />
          </tbody>
        </table>
      </div>
    </ReportWrapper>
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
