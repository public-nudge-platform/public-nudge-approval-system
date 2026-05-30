import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAuditAction } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/constants";
import { generateBalanceSheet, formatDateDisplay } from "@/lib/reports";
import ExcelJS from "exceljs";
import type { UserRole } from "@prisma/client";

const BORDER_MEDIUM: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF444444" } };
const BORDER_THIN:   Partial<ExcelJS.Border> = { style: "thin",   color: { argb: "FF666666" } };

// Layout: A(1)=asset code  B(2)=asset name  C(3)=asset amount
//         D(4)=spacer
//         E(5)=liab code   F(6)=liab name   G(7)=liab amount

type SideRow =
  | { kind: "section"; name: string }
  | { kind: "data";    code?: string; name: string; amount: number }
  | { kind: "total";   name: string; amount: number; border?: "thin" | "medium" }
  | { kind: "blank" };

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

  // ─── Build workbook ───────────────────────────────────────────────────────

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("資產負債表");

  ws.columns = [
    { width: 10 }, // A asset code
    { width: 24 }, // B asset name
    { width: 16 }, // C asset amount
    { width: 3  }, // D spacer
    { width: 10 }, // E liab code
    { width: 26 }, // F liab name
    { width: 16 }, // G liab amount
  ];

  let r = 1;

  // ── Title block ──
  ws.mergeCells(r, 1, r, 7);
  const orgCell = ws.getCell(r, 1);
  orgCell.value     = "公民幫推";
  orgCell.font      = { bold: true, size: 14 };
  orgCell.alignment = { horizontal: "center" };
  ws.getRow(r).height = 22;
  r++;

  ws.mergeCells(r, 1, r, 7);
  const titleCell = ws.getCell(r, 1);
  titleCell.value     = "資產負債表";
  titleCell.font      = { bold: true, size: 12 };
  titleCell.alignment = { horizontal: "center" };
  ws.getRow(r).height = 18;
  r++;

  // Date row: A:F merged, G has 幣別
  ws.mergeCells(r, 1, r, 6);
  const dateCell = ws.getCell(r, 1);
  dateCell.value     = formatDateDisplay(data.asOf);
  dateCell.alignment = { horizontal: "center" };
  const wCell = ws.getCell(r, 7);
  wCell.value     = "幣別：新台幣";
  wCell.alignment = { horizontal: "right" };
  wCell.font      = { size: 10, color: { argb: "FF555555" } };
  ws.getRow(r).height = 14;
  r++;

  r++; // blank

  // ── Unbalanced warning ──
  if (!data.balanced) {
    ws.mergeCells(r, 1, r, 7);
    const warn = ws.getCell(r, 1);
    warn.value = "※ 資產總額與負債＋基金暨餘絀總額不相等，請確認期初帳資料是否完整。";
    warn.font  = { color: { argb: "FF92400E" } };
    warn.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
    r++;
  }

  // ── Column headers ──
  [
    [1, "項目代號", "center"],
    [2, "項目名稱", "left"],
    [3, "金額",     "right"],
    [5, "項目代號", "center"],
    [6, "項目名稱", "left"],
    [7, "金額",     "right"],
  ].forEach(([col, value, align]) => {
    const c = ws.getCell(r, col as number);
    c.value     = value as string;
    c.font      = { bold: true };
    c.border    = { bottom: BORDER_MEDIUM };
    c.alignment = { horizontal: align as ExcelJS.Alignment["horizontal"] };
  });
  ws.getRow(r).height = 16;
  r++;

  // ── Side-row writer ──
  function writeSide(sideRow: SideRow, rowNum: number, codeCol: number) {
    const nameCol = codeCol + 1;
    const amtCol  = codeCol + 2;

    switch (sideRow.kind) {
      case "section":
        ws.getCell(rowNum, nameCol).value = sideRow.name;
        ws.getCell(rowNum, nameCol).font  = { bold: true };
        break;

      case "data":
        if (sideRow.code) {
          ws.getCell(rowNum, codeCol).value     = sideRow.code;
          ws.getCell(rowNum, codeCol).alignment = { horizontal: "center" };
          ws.getCell(rowNum, codeCol).font      = { color: { argb: "FF888888" } };
        }
        ws.getCell(rowNum, nameCol).value     = sideRow.name;
        ws.getCell(rowNum, nameCol).alignment = { indent: 1 };
        ws.getCell(rowNum, amtCol).value      = sideRow.amount;
        ws.getCell(rowNum, amtCol).numFmt     = "#,##0";
        ws.getCell(rowNum, amtCol).alignment  = { horizontal: "right" };
        break;

      case "total": {
        ws.getCell(rowNum, nameCol).value = sideRow.name;
        ws.getCell(rowNum, nameCol).font  = { bold: true };
        const ac = ws.getCell(rowNum, amtCol);
        ac.value     = sideRow.amount;
        ac.numFmt    = "#,##0";
        ac.alignment = { horizontal: "right" };
        ac.font      = { bold: true };
        if (sideRow.border) {
          ac.border = { bottom: sideRow.border === "medium" ? BORDER_MEDIUM : BORDER_THIN };
        }
        break;
      }

      case "blank":
        break;
    }
  }

  // ── Build and zip side rows ──
  const assetRows: SideRow[] = [
    { kind: "section", name: "流動資產" },
    ...data.cashAccounts.map((acc) => ({
      kind: "data" as const,
      code: acc.code,
      name: acc.name,
      amount: acc.balance,
    })),
    { kind: "total", name: "現金合計",     amount: data.cashTotal,           border: "thin"   as const },
    { kind: "data",  code: "1230", name: "應收款項", amount: data.receivables },
    { kind: "data",  code: "1250", name: "預付款項", amount: data.prepaid     },
    { kind: "total", name: "流動資產合計", amount: data.currentAssetsTotal,   border: "thin"   as const },
    { kind: "blank" },
    { kind: "blank" },
    { kind: "total", name: "資產總額",     amount: data.assetsTotal,          border: "medium" as const },
    { kind: "blank" },
  ];

  const liabRows: SideRow[] = [
    { kind: "section", name: "流動負債" },
    { kind: "data",  code: "2130", name: "應付款項", amount: data.payables   },
    { kind: "data",  code: "2150", name: "預收款項", amount: data.preReceived },
    { kind: "total", name: "流動負債合計",       amount: data.currentLiabilitiesTotal, border: "thin"   as const },
    { kind: "blank" },
    { kind: "total", name: "負債總額",           amount: data.liabilitiesTotal,        border: "thin"   as const },
    { kind: "blank" },
    { kind: "section", name: "基金暨餘絀" },
    { kind: "data",  code: "3210", name: "累計餘絀", amount: data.accumulatedSurplus },
    { kind: "data",  code: "3440", name: "本期餘絀", amount: data.currentSurplus     },
    { kind: "total", name: "基金暨餘絀總額",     amount: data.fundTotal,               border: "thin"   as const },
    { kind: "blank" },
    { kind: "total", name: "負債、基金暨餘絀總額", amount: data.liabilitiesAndFundTotal, border: "medium" as const },
    { kind: "blank" },
  ];

  const maxRows = Math.max(assetRows.length, liabRows.length);
  for (let i = 0; i < maxRows; i++) {
    const ar = assetRows[i];
    const lr = liabRows[i];
    if (ar) writeSide(ar, r, 1); // cols 1–3
    if (lr) writeSide(lr, r, 5); // cols 5–7
    r++;
  }

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

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Blob([buf]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
