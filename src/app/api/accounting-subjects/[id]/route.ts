import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { ACCOUNTING_MANAGE_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!ACCOUNTING_MANAGE_ROLES.includes(role)) {
    return NextResponse.json({ error: "無管理會計科目權限" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { code, name, direction, isActive } = body;

  const existing = await prisma.accountingSubject.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "找不到會計科目" }, { status: 404 });

  // Check code uniqueness if code changed
  if (code && code.trim() !== existing.code) {
    const conflict = await prisma.accountingSubject.findUnique({ where: { code: code.trim() } });
    if (conflict) return NextResponse.json({ error: "代號已存在" }, { status: 400 });
  }

  const updated = await prisma.accountingSubject.update({
    where: { id },
    data: {
      ...(code !== undefined && { code: code.trim() }),
      ...(name !== undefined && { name: name.trim() }),
      ...(direction !== undefined && { direction: direction.trim() }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  const wasDeactivated = existing.isActive && isActive === false;
  const auditAction = wasDeactivated ? "ACCOUNTING_SUBJECT_DEACTIVATED" : "ACCOUNTING_SUBJECT_UPDATED";

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: auditAction,
    entityType: "AccountingSubject",
    entityId: id,
    description: wasDeactivated
      ? `停用會計科目「${updated.code} ${updated.name}」`
      : `編輯會計科目「${updated.code} ${updated.name}」`,
    beforeData: { code: existing.code, name: existing.name, direction: existing.direction, isActive: existing.isActive },
    afterData: { code: updated.code, name: updated.name, direction: updated.direction, isActive: updated.isActive },
  });

  return NextResponse.json(updated);
}
