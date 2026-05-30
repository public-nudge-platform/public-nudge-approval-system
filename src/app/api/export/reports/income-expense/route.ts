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
  if (!FINANCE_ROLES.includes(role))
    return NextResponse.json({ error: "無匯出權限" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
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

  // ─── Build XLSX ───────────────────────────────────────────────────────────

  const wb = XLSX.utils.book_new();

  // We build an array-of-arrays, then apply styles row by row.
  // Columns: A=項目代號, B=項目名稱, C=金額, D=%
  // A: col 0, B: col 1, C: col 2, D: col 3

  type Row = (string | number | null)[];
  const rows: Row[] = [];
  // track which rows need bold / bottom-border treatment
  const boldRows = new Set<number>();
  const borderRows = new Set<number>(); // single bottom border on C,D
  const doubleBorderRows = new Set<number>(); // double bottom border on C,D

  function pushRow(row: Row, options?: { bold?: boolean; border?: "single" | "double" }) {
    const idx = rows.length;
    rows.push(row);
    if (options?.bold) boldRows.add(idx);
    if (options?.border === "single") borderRows.add(idx);
    if (options?.border === "double") doubleBorderRows.add(idx);
  }

  const pct = (n: number) =>
    data.incomeTotal > 0 ? n / data.incomeTotal : 0;

  // Title rows
  pushRow(["公民幫推", null, null, null], { bold: true });
  pushRow(
    [data.projectName ? `專案收支表 — ${data.projectName}` : "收支表", null, null, null],
    { bold: true }
  );
  pushRow(
    [`${formatDateDisplay(data.periodFrom)}～　${formatDateDisplay(data.periodTo)}`, null, null, null]
  );
  pushRow([null, null, null, "幣別：新台幣"]);
  pushRow([]); // blank
  // Column headers
  pushRow(["項目代號", "項目名稱", "金額", "%"], { bold: true, border: "single" });

  // 收入 section
  pushRow([null, "收入", null, null], { bold: true });
  for (const item of data.incomeItems) {
    pushRow([item.code, item.name, item.amount, pct(item.amount)]);
  }
  pushRow([null, "收入合計", data.incomeTotal, pct(data.incomeTotal)], {
    bold: true,
    border: "single",
  });
  pushRow([]); // blank

  // 支出 section
  pushRow([null, "支出", null, null], { bold: true });
  for (const group of data.expenseGroups) {
    pushRow([null, group.groupName, null, null], { bold: true });
    for (const item of group.items) {
      pushRow([item.code, item.name, item.amount, pct(item.amount)]);
    }
    pushRow([null, `${group.groupName}合計`, group.subtotal, pct(group.subtotal)], {
      bold: true,
      border: "single",
    });
    pushRow([]); // blank after each group
  }
  pushRow([null, "支出合計", data.expenseTotal, pct(data.expenseTotal)], {
    bold: true,
    border: "double",
  });
  pushRow([]); // blank

  // 本期餘絀
  pushRow([null, "本期餘絀", data.netSurplus, pct(data.netSurplus)], {
    bold: true,
    border: "double",
  });
  pushRow([]); // trailing blank

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 10 }, // A 項目代號
    { wch: 28 }, // B 項目名稱
    { wch: 14 }, // C 金額
    { wch: 10 }, // D %
  ];

  // Apply styles
  rows.forEach((row, r) => {
    const isBold = boldRows.has(r);
    const isBorder = borderRows.has(r);
    const isDouble = doubleBorderRows.has(r);

    row.forEach((val, c) => {
      if (val === null || val === undefined) return;
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) return;

      const s: Record<string, unknown> = {};
      if (isBold) s.font = { bold: true };

      // Bottom border on amount (C=2) and % (D=3) columns
      if ((isBorder || isDouble) && (c === 2 || c === 3)) {
        s.border = {
          bottom: { style: isDouble ? "medium" : "thin", color: { rgb: "000000" } },
        };
      }

      // Format C (金額) as number with thousands separator
      if (c === 2 && typeof val === "number") {
        ws[ref].z = "#,##0";
      }
      // Format D (%) as percentage
      if (c === 3 && typeof val === "number") {
        ws[ref].z = "0.00%";
      }

      if (Object.keys(s).length > 0) ws[ref].s = s;
    });

    // 幣別 row: right-align D column
    if (row[3] === "幣別：新台幣") {
      const ref = XLSX.utils.encode_cell({ r, c: 3 });
      if (ws[ref]) ws[ref].s = { alignment: { horizontal: "right" } };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, "收支表");

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new NextResponse(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
