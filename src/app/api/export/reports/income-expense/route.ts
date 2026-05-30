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
import ExcelJS from "exceljs";
import type { UserRole } from "@prisma/client";

const BORDER_MEDIUM: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF444444" } };
const BORDER_THIN:   Partial<ExcelJS.Border> = { style: "thin",   color: { argb: "FF666666" } };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role))
    return NextResponse.json({ error: "無匯出權限" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month     = searchParams.get("month")     || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate   = searchParams.get("endDate")   || undefined;
  const projectId = searchParams.get("projectId") || undefined;

  const period = parsePeriodParams({ month, startDate, endDate });
  if (!period) return NextResponse.json({ error: "請提供查詢期間" }, { status: 400 });

  let projectName: string | null = null;
  if (projectId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    projectName = proj?.name ?? null;
  }

  const data = await generateIncomeExpenseStatement({ from: period.from, to: period.to, projectId });

  // ─── Build workbook ───────────────────────────────────────────────────────

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("收支表");

  ws.columns = [
    { width: 12 }, // A 項目代號
    { width: 32 }, // B 項目名稱
    { width: 16 }, // C 金額
    { width: 12 }, // D %
  ];

  const pct = (n: number) => (data.incomeTotal > 0 ? n / data.incomeTotal : 0);
  let r = 1;

  // ── Title block ──
  ws.mergeCells(r, 1, r, 4);
  const orgCell = ws.getCell(r, 1);
  orgCell.value     = "公民幫推";
  orgCell.font      = { bold: true, size: 14 };
  orgCell.alignment = { horizontal: "center" };
  ws.getRow(r).height = 22;
  r++;

  ws.mergeCells(r, 1, r, 4);
  const titleCell = ws.getCell(r, 1);
  titleCell.value     = data.projectName ? `專案收支表 — ${data.projectName}` : "收支表";
  titleCell.font      = { bold: true, size: 12 };
  titleCell.alignment = { horizontal: "center" };
  ws.getRow(r).height = 18;
  r++;

  ws.mergeCells(r, 1, r, 4);
  const dateCell = ws.getCell(r, 1);
  dateCell.value     = `${formatDateDisplay(data.periodFrom)}～　${formatDateDisplay(data.periodTo)}`;
  dateCell.alignment = { horizontal: "center" };
  ws.getRow(r).height = 14;
  r++;

  const wCell = ws.getCell(r, 4);
  wCell.value     = "幣別：新台幣";
  wCell.alignment = { horizontal: "right" };
  wCell.font      = { size: 10, color: { argb: "FF555555" } };
  r++;

  r++; // blank

  // ── Column headers ──
  const hCols: [number, string, ExcelJS.Alignment["horizontal"]][] = [
    [1, "項目代號", "center"],
    [2, "項目名稱", "left"],
    [3, "金額",     "right"],
    [4, "%",        "right"],
  ];
  hCols.forEach(([col, value, align]) => {
    const c = ws.getCell(r, col);
    c.value     = value;
    c.font      = { bold: true };
    c.border    = { bottom: BORDER_MEDIUM };
    c.alignment = { horizontal: align };
  });
  ws.getRow(r).height = 16;
  r++;

  // ── 收入 section ──
  ws.getCell(r, 2).value = "收入";
  ws.getCell(r, 2).font  = { bold: true };
  r++;

  for (const item of data.incomeItems) {
    ws.getCell(r, 1).value     = item.code;
    ws.getCell(r, 1).alignment = { horizontal: "center" };
    ws.getCell(r, 1).font      = { color: { argb: "FF888888" } };
    ws.getCell(r, 2).value     = item.name;
    ws.getCell(r, 2).alignment = { indent: 2 };

    const a = ws.getCell(r, 3);
    a.value = item.amount; a.numFmt = "#,##0"; a.alignment = { horizontal: "right" };

    const p = ws.getCell(r, 4);
    p.value = pct(item.amount); p.numFmt = "0.00%"; p.alignment = { horizontal: "right" };
    r++;
  }

  // 收入合計
  ws.getCell(r, 2).value = "收入合計";
  ws.getCell(r, 2).font  = { bold: true };
  const incA = ws.getCell(r, 3);
  incA.value = data.incomeTotal; incA.numFmt = "#,##0"; incA.alignment = { horizontal: "right" };
  incA.font = { bold: true }; incA.border = { bottom: BORDER_THIN };
  const incP = ws.getCell(r, 4);
  incP.value = data.incomeTotal > 0 ? 1 : 0; incP.numFmt = "0.00%"; incP.alignment = { horizontal: "right" };
  incP.font = { bold: true }; incP.border = { bottom: BORDER_THIN };
  r++;

  r++; // blank

  // ── 支出 section ──
  ws.getCell(r, 2).value = "支出";
  ws.getCell(r, 2).font  = { bold: true };
  r++;

  for (const group of data.expenseGroups) {
    // Group header
    ws.getCell(r, 2).value     = group.groupName;
    ws.getCell(r, 2).font      = { bold: true };
    ws.getCell(r, 2).alignment = { indent: 1 };
    r++;

    // Items
    for (const item of group.items) {
      ws.getCell(r, 1).value     = item.code;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      ws.getCell(r, 1).font      = { color: { argb: "FF888888" } };
      ws.getCell(r, 2).value     = item.name;
      ws.getCell(r, 2).alignment = { indent: 3 };

      const a = ws.getCell(r, 3);
      a.value = item.amount; a.numFmt = "#,##0"; a.alignment = { horizontal: "right" };

      const p = ws.getCell(r, 4);
      p.value = pct(item.amount); p.numFmt = "0.00%"; p.alignment = { horizontal: "right" };
      r++;
    }

    // Group subtotal
    ws.getCell(r, 2).value     = `${group.groupName}合計`;
    ws.getCell(r, 2).font      = { bold: true };
    ws.getCell(r, 2).alignment = { indent: 1 };
    const gsA = ws.getCell(r, 3);
    gsA.value = group.subtotal; gsA.numFmt = "#,##0"; gsA.alignment = { horizontal: "right" };
    gsA.font = { bold: true }; gsA.border = { bottom: BORDER_THIN };
    const gsP = ws.getCell(r, 4);
    gsP.value = pct(group.subtotal); gsP.numFmt = "0.00%"; gsP.alignment = { horizontal: "right" };
    gsP.font = { bold: true }; gsP.border = { bottom: BORDER_THIN };
    r++;

    r++; // blank after group
  }

  // 支出合計
  ws.getCell(r, 2).value = "支出合計";
  ws.getCell(r, 2).font  = { bold: true };
  const expA = ws.getCell(r, 3);
  expA.value = data.expenseTotal; expA.numFmt = "#,##0"; expA.alignment = { horizontal: "right" };
  expA.font = { bold: true }; expA.border = { bottom: BORDER_MEDIUM };
  const expP = ws.getCell(r, 4);
  expP.value = pct(data.expenseTotal); expP.numFmt = "0.00%"; expP.alignment = { horizontal: "right" };
  expP.font = { bold: true }; expP.border = { bottom: BORDER_MEDIUM };
  r++;

  r++; // blank

  // 本期餘絀
  ws.getCell(r, 2).value = "本期餘絀";
  ws.getCell(r, 2).font  = { bold: true, size: 12 };
  const netA = ws.getCell(r, 3);
  netA.value = data.netSurplus; netA.numFmt = "#,##0"; netA.alignment = { horizontal: "right" };
  netA.font = { bold: true, size: 12 }; netA.border = { bottom: BORDER_MEDIUM };
  const netP = ws.getCell(r, 4);
  netP.value = pct(data.netSurplus); netP.numFmt = "0.00%"; netP.alignment = { horizontal: "right" };
  netP.font = { bold: true, size: 12 }; netP.border = { bottom: BORDER_MEDIUM };

  // ─── Filename ─────────────────────────────────────────────────────────────

  const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");
  const prefix = projectName ? `${sanitize(projectName)}_收支表` : "收支表";
  let suffix: string;
  if (startDate || endDate) {
    suffix = `${(startDate ?? "").replace(/-/g, "")}-${(endDate ?? "").replace(/-/g, "")}`;
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

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Blob([buf]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
