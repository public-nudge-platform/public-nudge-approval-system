import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/constants";
import {
  generateIncomeExpenseStatement,
  parsePeriodParams,
  formatDateDisplay,
} from "@/lib/reports";
import * as XLSX from "xlsx";
import type { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: "無匯出權限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const projectId = searchParams.get("projectId") || undefined;

  const period = parsePeriodParams({ month, startDate, endDate });
  if (!period) {
    return NextResponse.json({ error: "請提供查詢期間" }, { status: 400 });
  }

  // Fetch project name for filename
  let projectName: string | null = null;
  if (projectId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    projectName = proj?.name ?? null;
  }

  const data = await generateIncomeExpenseStatement({
    from: period.from,
    to: period.to,
    projectId,
  });

  // ─── Build XLSX ───────────────────────────────────────────────────────────

  const wb = XLSX.utils.book_new();
  const wsData: (string | number | null)[][] = [];

  const fmt = formatDateDisplay;

  // Header rows
  wsData.push(["公民幫推"]);
  wsData.push([data.projectName ? `專案收支表 — ${data.projectName}` : "收支表"]);
  wsData.push([`期間：${fmt(data.periodFrom)} ～ ${fmt(data.periodTo)}`]);
  wsData.push(["幣別：新台幣"]);
  wsData.push([]); // blank
  wsData.push(["項目代號", "項目名稱", "金額", "%"]);

  // Income section
  wsData.push([null, "收入", null, null]);
  for (const item of data.incomeItems) {
    const pct = data.incomeTotal > 0 ? item.amount / data.incomeTotal : 0;
    wsData.push([item.code, item.name, item.amount, pct]);
  }
  const incomeTotalPct = data.incomeTotal > 0 ? 1 : 0;
  wsData.push([null, "收入合計", data.incomeTotal, incomeTotalPct]);
  wsData.push([]); // blank

  // Expense section
  wsData.push([null, "支出", null, null]);
  for (const group of data.expenseGroups) {
    wsData.push([null, group.groupName, null, null]);
    for (const item of group.items) {
      const pct = data.incomeTotal > 0 ? item.amount / data.incomeTotal : 0;
      wsData.push([item.code, item.name, item.amount, pct]);
    }
    const gPct = data.incomeTotal > 0 ? group.subtotal / data.incomeTotal : 0;
    wsData.push([null, `${group.groupName}合計`, group.subtotal, gPct]);
    wsData.push([]);
  }

  const expenseTotalPct = data.incomeTotal > 0 ? data.expenseTotal / data.incomeTotal : 0;
  wsData.push([null, "支出合計", data.expenseTotal, expenseTotalPct]);
  wsData.push([]); // blank

  // Net surplus
  const surplusPct = data.incomeTotal > 0 ? data.netSurplus / data.incomeTotal : 0;
  wsData.push([null, "本期餘絀", data.netSurplus, surplusPct]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 10 }, // 項目代號
    { wch: 28 }, // 項目名稱
    { wch: 14 }, // 金額
    { wch: 9 },  // %
  ];

  // Bold: rows 0 (org name), 5 (header), and totals
  function boldCell(r: number, c: number) {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) return;
    ws[ref].s = { font: { bold: true } };
  }

  // Header rows
  boldCell(0, 0);
  boldCell(1, 0);
  boldCell(5, 0); boldCell(5, 1); boldCell(5, 2); boldCell(5, 3);

  // Mark totals: walk rows and bold rows where col B ends with "合計" or is "本期餘絀"
  const totalKeywords = ["合計", "本期餘絀"];
  wsData.forEach((row, r) => {
    const label = row[1];
    if (typeof label === "string" && totalKeywords.some((k) => label.endsWith(k) || label === k)) {
      for (let c = 0; c < 4; c++) boldCell(r, c);
    }
  });

  // Format % column as percentage
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (cell && typeof cell.v === "number") {
      cell.z = "0.0%";
      cell.t = "n";
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "收支表");

  // ─── Filename ─────────────────────────────────────────────────────────────

  const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");
  const prefix = projectName ? `${sanitize(projectName)}_收支表` : "收支表";

  let suffix: string;
  if (startDate || endDate) {
    const s = (startDate ?? "").replace(/-/g, "");
    const e = (endDate ?? "").replace(/-/g, "");
    suffix = s && e ? `${s}-${e}` : s || e;
  } else if (month) {
    suffix = month.replace(/-/g, "");
  } else {
    const d = period.from;
    suffix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const filename = `${prefix}_${suffix}.xlsx`;

  // ─── Audit log ────────────────────────────────────────────────────────────

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "DATA_EXPORTED",
    entityType: "Report",
    description: `匯出收支表「${filename}」`,
    afterData: {
      reportType: "income-expense",
      filename,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      projectId: projectId ?? null,
      incomeTotal: data.incomeTotal,
      expenseTotal: data.expenseTotal,
      netSurplus: data.netSurplus,
    },
  });

  // ─── Response ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
