import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAuditAction } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/constants";
import {
  generateBalanceSheet,
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
  const asOfParam = searchParams.get("asOf");

  if (!asOfParam) {
    return NextResponse.json({ error: "請提供截至日期" }, { status: 400 });
  }

  const asOf = new Date(`${asOfParam}T23:59:59`);
  if (isNaN(asOf.getTime())) {
    return NextResponse.json({ error: "截至日期格式錯誤" }, { status: 400 });
  }

  const data = await generateBalanceSheet({ asOf });

  // ─── Build XLSX ───────────────────────────────────────────────────────────

  const wb = XLSX.utils.book_new();

  // Side-by-side layout: cols A-C = assets, col D = spacer, cols E-G = liabilities
  // Rows are written to match the Excel layout

  const ws: XLSX.WorkSheet = {};

  let r = 0; // current row

  function setCell(row: number, col: number, value: string | number | null, bold = false) {
    if (value === null || value === undefined) return;
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    ws[ref] = { t: typeof value === "number" ? "n" : "s", v: value };
    if (bold) ws[ref].s = { font: { bold: true } };
  }

  function numCell(row: number, col: number, value: number, bold = false) {
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    ws[ref] = { t: "n", v: value, z: "#,##0" };
    if (bold) ws[ref].s = { font: { bold: true } };
  }

  const fmt = formatDateDisplay;

  // Row 0: org name
  setCell(r, 0, "公民幫推", true);
  r++;

  // Row 1: report title
  setCell(r, 0, "資產負債表（系統管理用簡化版）", true);
  r++;

  // Row 2: as-of date
  setCell(r, 0, `截至：${fmt(data.asOf)}`);
  setCell(r, 4, "幣別：新台幣");
  r++;

  // Row 3: blank
  r++;

  // Row 4: column headers
  setCell(r, 0, "代號", true); setCell(r, 1, "資產", true); setCell(r, 2, "金額", true);
  setCell(r, 4, "代號", true); setCell(r, 5, "負債及基金", true); setCell(r, 6, "金額", true);
  r++;

  // Now build rows in parallel — assets on left, liabilities on right
  type SideRow = {
    code: string | null;
    name: string;
    amount: number | null;
    bold: boolean;
    header: boolean; // section heading, no amount
  };

  const assetRows: SideRow[] = [];
  const liabilityRows: SideRow[] = [];

  // ─── Assets ───────────────────────────────────────────────────────────────
  assetRows.push({ code: null, name: "流動資產", amount: null, bold: false, header: true });
  for (const acc of data.cashAccounts) {
    assetRows.push({ code: acc.code, name: acc.name, amount: acc.balance, bold: false, header: false });
  }
  assetRows.push({ code: null, name: "現金及銀行存款合計", amount: data.cashTotal, bold: true, header: false });

  if (data.receivables > 0) {
    assetRows.push({ code: "1230", name: "應收款項", amount: data.receivables, bold: false, header: false });
  }
  if (data.prepaid > 0) {
    assetRows.push({ code: "1250", name: "預付款項", amount: data.prepaid, bold: false, header: false });
  }
  assetRows.push({ code: null, name: "流動資產合計", amount: data.currentAssetsTotal, bold: true, header: false });
  assetRows.push({ code: null, name: "", amount: null, bold: false, header: false }); // spacer
  assetRows.push({ code: null, name: "資產總額", amount: data.assetsTotal, bold: true, header: false });

  // ─── Liabilities & Fund ───────────────────────────────────────────────────
  liabilityRows.push({ code: null, name: "流動負債", amount: null, bold: false, header: true });
  liabilityRows.push({ code: "2130", name: "應付款項", amount: data.payables, bold: false, header: false });
  if (data.preReceived > 0) {
    liabilityRows.push({ code: "2150", name: "預收款項", amount: data.preReceived, bold: false, header: false });
  }
  liabilityRows.push({ code: null, name: "流動負債合計", amount: data.currentLiabilitiesTotal, bold: true, header: false });
  liabilityRows.push({ code: null, name: "負債總額", amount: data.liabilitiesTotal, bold: true, header: false });
  liabilityRows.push({ code: null, name: "", amount: null, bold: false, header: false }); // spacer
  liabilityRows.push({ code: null, name: "基金暨餘絀", amount: null, bold: false, header: true });
  liabilityRows.push({ code: "3210", name: "累計餘絀", amount: data.accumulatedSurplus, bold: false, header: false });
  liabilityRows.push({ code: "3440", name: "本期餘絀", amount: data.currentSurplus, bold: false, header: false });
  liabilityRows.push({ code: null, name: "基金暨餘絀總額", amount: data.fundTotal, bold: true, header: false });
  liabilityRows.push({ code: null, name: "", amount: null, bold: false, header: false }); // spacer
  liabilityRows.push({
    code: null,
    name: "負債、基金暨餘絀總額",
    amount: data.liabilitiesAndFundTotal,
    bold: true,
    header: false,
  });

  // Write rows
  const maxRows = Math.max(assetRows.length, liabilityRows.length);
  for (let i = 0; i < maxRows; i++) {
    const ar = assetRows[i];
    const lr = liabilityRows[i];

    if (ar) {
      if (ar.header) {
        setCell(r, 1, ar.name, true);
      } else {
        if (ar.code) setCell(r, 0, ar.code, ar.bold);
        setCell(r, 1, ar.name, ar.bold);
        if (ar.amount !== null) numCell(r, 2, ar.amount, ar.bold);
      }
    }

    if (lr) {
      if (lr.header) {
        setCell(r, 5, lr.name, true);
      } else {
        if (lr.code) setCell(r, 4, lr.code, lr.bold);
        setCell(r, 5, lr.name, lr.bold);
        if (lr.amount !== null) numCell(r, 6, lr.amount, lr.bold);
      }
    }

    r++;
  }

  // Balance check note
  r++;
  if (!data.balanced) {
    setCell(r, 0, "※ 資產總額與負債＋基金暨餘絀總額不相等，請確認系統資料（如期初帳）是否完整。");
    r++;
  }

  // Set worksheet range
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 6 } });

  // Column widths
  ws["!cols"] = [
    { wch: 8 },  // A: 代號 (assets)
    { wch: 22 }, // B: 資產名稱
    { wch: 14 }, // C: 金額
    { wch: 3 },  // D: spacer
    { wch: 8 },  // E: 代號 (liabilities)
    { wch: 24 }, // F: 負債名稱
    { wch: 14 }, // G: 金額
  ];

  XLSX.utils.book_append_sheet(wb, ws, "資產負債表");

  // ─── Filename ─────────────────────────────────────────────────────────────

  const dateStr = asOfParam.replace(/-/g, "");
  const filename = `資產負債表_${dateStr}.xlsx`;

  // ─── Audit log ────────────────────────────────────────────────────────────

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "DATA_EXPORTED",
    entityType: "Report",
    description: `匯出資產負債表「${filename}」`,
    afterData: {
      reportType: "balance-sheet",
      filename,
      asOf: asOfParam,
      assetsTotal: data.assetsTotal,
      liabilitiesAndFundTotal: data.liabilitiesAndFundTotal,
      balanced: data.balanced,
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
