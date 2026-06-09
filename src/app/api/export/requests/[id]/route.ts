import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/constants";
import { buildRequestWorkbook, TooManyItemsError } from "@/lib/requestExport";
import type { UserRole } from "@prisma/client";

const EXPORTABLE_STATUSES = ["PAID", "CLOSED"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role))
    return NextResponse.json({ error: "無匯出權限" }, { status: 403 });

  const { id } = await params;

  const request = await prisma.request.findUnique({
    where: { id },
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

  if (!request) return NextResponse.json({ error: "找不到請款單" }, { status: 404 });
  if (!EXPORTABLE_STATUSES.includes(request.status))
    return NextResponse.json({ error: "僅已付款或已沖銷完成的請款單可匯出" }, { status: 400 });

  let wb;
  try {
    wb = await buildRequestWorkbook(request);
  } catch (err) {
    if (err instanceof TooManyItemsError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const filenameBase = request.requestNumber ?? request.id;
  const filename = `請款單_${filenameBase}.xlsx`;

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "DATA_EXPORTED",
    entityType: "Request",
    entityId: request.id,
    description: `匯出請款單「${filename}」`,
    afterData: { filename, requestId: request.id },
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Blob([buf]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
