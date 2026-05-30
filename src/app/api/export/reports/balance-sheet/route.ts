import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAuditAction } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/constants";
import { generateBalanceSheet, formatDateDisplay } from "@/lib/reports";
import * as XLSX from "xlsx";
import type { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role))
    return NextResponse.json({ error: "無匯出權限" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const asOfParam = searchParams.get("asOf");
  if (!asOfParam) return NextResponse.json({ error: "請提供截至日期" }, { status: 400 });

  const asOf = new Date(`${asOfParam}T23:59:59`);
  if (isNaN(asOf.getTime())) return NextResponse.json({ error: "截至日期格式錯誤" }, { status: 400 });

  const data = await generateBalanceSheet({ asOf });

  // ─── Build XLSX ───────────────────────────────────────────────────────────
  // Layout mirrors the Excel screenshot:
  // Cols A-C = Assets,  col D = spacer,  Cols E-G = Liabilities + Fund
  // A=代號(asset) B=名稱(asset) C=金額(asset)  E=代號(liab) F=名稱(liab) G=金額(liab)

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  let maxRow = 0;

  // Helper: write a cell
  function cell(
    r: number,
    c: number,
    value: string | number | null,
    opts?: { bold?: boolean; border?: "single" | "double"; numFmt?: string; align?: "center" | "right" | "left" }
  ) {
    if (value === null || value === undefined) return;
    const ref = XLSX.utils.encode_cell({ r, c });
    ws[ref] = { t: typeof value === "number" ? "n" : "s", v: value };
    const s: Record<string, unknown> = {};
    if (opts?.bold) s.font = { bold: true };
    if (opts?.border) {
      s.border = {
        bottom: {
          style: opts.border === "double" ? "medium" : "thin",
          color: { rgb: "000000" },
        },
      };
    }
    if (opts?.numFmt) ws[ref].z = opts.numFmt;
    if (opts?.align) s.alignment = { horizontal: opts.align };
    if (Object.keys(s).length > 0) ws[ref].s = s;
    if (r > maxRow) maxRow = r;
  }

  function numCell(
    r: number,
    c: number,
    value: number,
    opts?: { bold?: boolean; border?: "single" | "double" }
  ) {
    cell(r, c, value, { ...opts, numFmt: "#,##0" });
  }

  let r = 0;

  // ── Title rows (span A-G visually; just write in A) ──
  cell(r, 0, "公民幫推", { bold: true, align: "center" });
  r++;
  cell(r, 0, "資產負債表", { bold: true, align: "center" });
  r++;
  cell(r, 0, formatDateDisplay(data.asOf), { align: "center" });
  cell(r, 6, "幣別：新台幣", { align: "right" });
  r++;
  r++; // blank

  // ── Column headers ──
  cell(r, 0, "項目代號", { bold: true });
  cell(r, 1, "項目名稱", { bold: true });
  cell(r, 2, "金額", { bold: true });
  cell(r, 4, "項目代號", { bold: true });
  cell(r, 5, "項目名稱", { bold: true });
  cell(r, 6, "金額", { bold: true });
  const headerRow = r;
  r++;

  // ── Data rows (assets left, liabilities right, aligned by row) ──
  //
  // Build two lists of "side rows" then zip them together.
  type SideRow =
    | { kind: "section"; name: string }
    | { kind: "data"; code?: string; name: string; amount: number }
    | { kind: "total"; name: string; amount: number; border?: "single" | "double" }
    | { kind: "blank" };

  const assetRows: SideRow[] = [];
  const liabRows: SideRow[] = [];

  // Assets
  assetRows.push({ kind: "section", name: "流動資產" });
  for (const acc of data.cashAccounts) {
    assetRows.push({ kind: "data", code: acc.code, name: acc.name, amount: acc.balance });
  }
  assetRows.push({ kind: "total", name: "現金合計", amount: data.cashTotal, border: "single" });
  assetRows.push({ kind: "data", code: "1230", name: "應收款項", amount: data.receivables });
  assetRows.push({ kind: "data", code: "1250", name: "預付款項", amount: data.prepaid });
  assetRows.push({ kind: "total", name: "流動資產合計", amount: data.currentAssetsTotal, border: "single" });
  assetRows.push({ kind: "blank" });
  assetRows.push({ kind: "blank" });
  assetRows.push({ kind: "total", name: "資產總額", amount: data.assetsTotal, border: "double" });
  assetRows.push({ kind: "blank" });

  // Liabilities
  liabRows.push({ kind: "section", name: "流動負債" });
  liabRows.push({ kind: "data", code: "2130", name: "應付款項", amount: data.payables });
  liabRows.push({ kind: "data", code: "2150", name: "預收款項", amount: data.preReceived });
  liabRows.push({ kind: "total", name: "流動負債合計", amount: data.currentLiabilitiesTotal, border: "single" });
  liabRows.push({ kind: "blank" });
  liabRows.push({ kind: "total", name: "負債總額", amount: data.liabilitiesTotal, border: "single" });
  liabRows.push({ kind: "blank" });
  liabRows.push({ kind: "section", name: "基金暨餘絀" });
  liabRows.push({ kind: "data", code: "3210", name: "累計餘絀", amount: data.accumulatedSurplus });
  liabRows.push({ kind: "data", code: "3440", name: "本期餘絀", amount: data.currentSurplus });
  liabRows.push({ kind: "total", name: "基金暨餘絀總額", amount: data.fundTotal, border: "single" });
  liabRows.push({ kind: "blank" });
  liabRows.push({ kind: "total", name: "負債、基金暨餘絀總額", amount: data.liabilitiesAndFundTotal, border: "double" });
  liabRows.push({ kind: "blank" });

  const maxSideRows = Math.max(assetRows.length, liabRows.length);

  for (let i = 0; i < maxSideRows; i++) {
    const ar = assetRows[i];
    const lr = liabRows[i];

    if (ar) {
      switch (ar.kind) {
        case "section":
          cell(r, 1, ar.name, { bold: true });
          break;
        case "data":
          if (ar.code) cell(r, 0, ar.code, { align: "center" });
          cell(r, 1, ar.name);
          numCell(r, 2, ar.amount);
          break;
        case "total":
          cell(r, 1, ar.name, { bold: true });
          numCell(r, 2, ar.amount, { bold: true, border: ar.border });
          break;
        case "blank":
          break;
      }
    }

    if (lr) {
      switch (lr.kind) {
        case "section":
          cell(r, 5, lr.name, { bold: true });
          break;
        case "data":
          if (lr.code) cell(r, 4, lr.code, { align: "center" });
          cell(r, 5, lr.name);
          numCell(r, 6, lr.amount);
          break;
        case "total":
          cell(r, 5, lr.name, { bold: true });
          numCell(r, 6, lr.amount, { bold: true, border: lr.border });
          break;
        case "blank":
          break;
      }
    }

    r++;
  }

  // Border under header row
  for (let c = 0; c <= 6; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRow, c });
    if (ws[ref]) {
      ws[ref].s = {
        ...(ws[ref].s ?? {}),
        font: { bold: true },
        border: { bottom: { style: "medium", color: { rgb: "000000" } } },
      };
    }
  }

  if (!data.balanced) {
    r++;
    cell(r, 0, "※ 資產總額與負債＋基金暨餘絀總額不相等，請確認期初帳資料是否完整。");
  }

  // Merge title rows so text centres across the full 7-column width
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // 公民幫推
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // 資產負債表
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // date (A:F); G keeps 幣別
  ];

  // Row heights for title block
  ws["!rows"] = [{ hpt: 18 }, { hpt: 16 }, { hpt: 14 }, { hpt: 12 }];

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: 6 } });

  ws["!cols"] = [
    { wch: 8 },  // A 資產代號
    { wch: 22 }, // B 資產名稱
    { wch: 14 }, // C 資產金額
    { wch: 2 },  // D spacer
    { wch: 8 },  // E 負債代號
    { wch: 24 }, // F 負債名稱
    { wch: 14 }, // G 負債金額
  ];

  XLSX.utils.book_append_sheet(wb, ws, "資產負債表");

  // ─── Filename ─────────────────────────────────────────────────────────────

  const filename = `資產負債表_${asOfParam.replace(/-/g, "")}.xlsx`;

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
  return new NextResponse(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
