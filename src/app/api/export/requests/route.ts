import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { FINANCE_ROLES, PAYMENT_METHOD_LABEL, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from "@/lib/constants";
import * as XLSX from "xlsx";
import type { UserRole } from "@prisma/client";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function getOffsetStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING_SETTLEMENT: "待沖銷",
    OFFSET_SUBMITTED: "沖銷待確認",
    OFFSET_RETURNED: "沖銷退回補件",
    CLOSED: "已結案（沖銷完成）",
  };
  return map[status] ?? "";
}

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "");
}

function generateFilename(
  projectName: string,
  month?: string,
  startDate?: string,
  endDate?: string
): string {
  const base = sanitizeName(projectName);

  if (startDate || endDate) {
    if (startDate && endDate) {
      if (startDate === endDate) {
        return `${base}_${startDate.replace(/-/g, "")}.xlsx`;
      }
      const startMonth = startDate.substring(0, 7);
      const endMonth = endDate.substring(0, 7);
      if (startMonth === endMonth) {
        const prefix = startDate.replace(/-/g, "").substring(0, 6);
        const endDay = endDate.substring(8, 10);
        return `${base}_${prefix}-${endDay}.xlsx`;
      }
      return `${base}_${startDate.replace(/-/g, "")}-${endDate.replace(/-/g, "")}.xlsx`;
    }
    const single = (startDate || endDate)!;
    return `${base}_${single.replace(/-/g, "")}.xlsx`;
  }

  if (month) {
    return `${base}_${month.replace(/-/g, "")}.xlsx`;
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${base}_${y}${m}.xlsx`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: "無匯出權限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project") || undefined;
  const month = searchParams.get("month") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  // Date range takes priority over month
  let requestDateFilter: Record<string, Date> | undefined;
  if (startDate || endDate) {
    requestDateFilter = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(`${endDate}T23:59:59`) } : {}),
    };
  } else if (month) {
    const [year, mon] = month.split("-").map(Number);
    requestDateFilter = {
      gte: new Date(year, mon - 1, 1),
      lte: new Date(year, mon, 0, 23, 59, 59),
    };
  }

  const where = {
    ...(projectId ? { projectId } : {}),
    ...(requestDateFilter ? { requestDate: requestDateFilter } : {}),
  };

  const [requests, projectRecord] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { requestDate: "asc" },
      include: {
        submitter: { select: { name: true } },
        project: { select: { name: true } },
        accountingSubject: { select: { code: true, name: true, direction: true } },
        finalAccountingSubject: { select: { code: true, name: true, direction: true } },
      },
    }),
    projectId
      ? prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
      : null,
  ]);

  const projectName = projectRecord?.name ?? "全部專案";

  const rows = requests.map((req) => {
    const amount = Number(req.amount);
    const actual = req.actualAmount ? Number(req.actualAmount) : null;
    const diff = actual !== null ? actual - amount : null;

    return {
      流水編號: req.requestNumber ?? "",
      專案名稱: req.project?.name ?? req.projectName ?? "",
      請款類型: REQUEST_TYPE_LABEL[req.type],
      申請人: req.submitter.name,
      申請日期: formatDate(req.requestDate),
      狀態: REQUEST_STATUS_LABEL[req.status],
      申請會計科目代號: req.accountingSubject?.code ?? "",
      申請會計科目名稱: req.accountingSubject?.name ?? "",
      正式會計科目代號: req.finalAccountingSubject?.code ?? "",
      正式會計科目名稱: req.finalAccountingSubject?.name ?? "",
      借貸: req.finalAccountingSubject?.direction ?? req.accountingSubject?.direction ?? "",
      請款金額: amount,
      實際付款金額: actual ?? "",
      沖銷金額: actual ?? "",
      差額: diff ?? "",
      付款日期: formatDate(req.paidAt),
      付款方式: req.paymentMethod
        ? (PAYMENT_METHOD_LABEL[req.paymentMethod] ?? req.paymentMethod)
        : "",
      付款對象: req.paymentRecipientName ?? "",
      付款備註: req.paymentNote ?? "",
      沖銷狀態: getOffsetStatus(req.status),
      沖銷日期: formatDate(req.offsetReviewedAt),
      備註: req.reimbursementNote ?? "",
      最後更新時間: formatDate(req.updatedAt),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 10 }, { wch: 24 },
    { wch: 6 },  { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 12 },
    { wch: 12 }, { wch: 20 }, { wch: 16 },
  ];

  // Bold header row
  const headers = Object.keys(rows[0] ?? {});
  headers.forEach((_, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "請款紀錄");

  const filename = generateFilename(projectName, month, startDate, endDate);

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "DATA_EXPORTED",
    entityType: "Request",
    description: `匯出 Excel「${filename}」，共 ${requests.length} 筆`,
    afterData: {
      filename,
      count: requests.length,
      projectId: projectId ?? null,
      month: month ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xlsxBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([xlsxBuf], {
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
