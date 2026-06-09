import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/constants";
import { buildRequestWorkbook, TooManyItemsError } from "@/lib/requestExport";
import JSZip from "jszip";
import type { UserRole } from "@prisma/client";

const EXPORTABLE_STATUSES = ["PAID", "CLOSED"] as const;

export async function GET(req: NextRequest) {
  try {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role))
    return NextResponse.json({ error: "無匯出權限" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project") || undefined;
  const month = searchParams.get("month") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

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

  const requests = await prisma.request.findMany({
    where: {
      status: { in: [...EXPORTABLE_STATUSES] },
      ...(projectId ? { projectId } : {}),
      ...(requestDateFilter ? { requestDate: requestDateFilter } : {}),
    },
    orderBy: { requestDate: "asc" },
    include: {
      submitter: { select: { name: true } },
      project: { select: { name: true } },
      finalAccountingSubject: { select: { code: true, name: true } },
      items: {
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          voucherDate: true,
        },
      },
    },
  });

  if (requests.length === 0)
    return NextResponse.json({ error: "查無符合條件（已付款／已沖銷）的請款單" }, { status: 404 });

  const tooMany = requests.filter((r) => r.items.length > 5);
  if (tooMany.length > 0) {
    const labels = tooMany.map((r) => r.requestNumber ?? r.id).join("、");
    return NextResponse.json(
      { error: `以下請款單的費用明細項目數超過範本可容納上限（5 項），請拆分後再匯出：${labels}` },
      { status: 400 }
    );
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const r of requests) {
    let name = r.requestNumber ?? r.id;
    while (usedNames.has(name)) name = `${name}_`;
    usedNames.add(name);

    let wb;
    try {
      wb = await buildRequestWorkbook(r);
    } catch (err) {
      if (err instanceof TooManyItemsError) {
        return NextResponse.json({ error: `「${name}」：${err.message}` }, { status: 400 });
      }
      throw err;
    }
    const buf = await wb.xlsx.writeBuffer();
    zip.file(`請款單_${name}.xlsx`, buf);
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const filename = `請款單批次匯出_${stamp}.zip`;

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "DATA_EXPORTED",
    entityType: "Request",
    description: `批次匯出請款單「${filename}」，共 ${requests.length} 筆`,
    afterData: {
      filename,
      count: requests.length,
      projectId: projectId ?? null,
      month: month ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    },
  });

  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new NextResponse(new Blob([buf]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
  } catch (err) {
    console.error("[export/requests/template] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `匯出失敗：${msg}` }, { status: 500 });
  }
}
