import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditAction } from "@/lib/audit";
import { ACCOUNTING_MANAGE_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  const subjects = await prisma.accountingSubject.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { code: "asc" },
  });

  return NextResponse.json(subjects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const role = session.user.role as UserRole;
  if (!ACCOUNTING_MANAGE_ROLES.includes(role)) {
    return NextResponse.json({ error: "無管理會計科目權限" }, { status: 403 });
  }

  const body = await req.json();
  const { code, name, direction, isActive } = body;

  if (!code?.trim()) return NextResponse.json({ error: "代號為必填" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "名稱為必填" }, { status: 400 });

  const existing = await prisma.accountingSubject.findUnique({ where: { code: code.trim() } });
  if (existing) return NextResponse.json({ error: "代號已存在" }, { status: 400 });

  const subject = await prisma.accountingSubject.create({
    data: {
      code: code.trim(),
      name: name.trim(),
      direction: direction?.trim() ?? "",
      isActive: isActive !== false,
    },
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "ACCOUNTING_SUBJECT_CREATED",
    entityType: "AccountingSubject",
    entityId: subject.id,
    description: `新增會計科目「${subject.code} ${subject.name}」`,
    afterData: { code: subject.code, name: subject.name, direction: subject.direction, isActive: subject.isActive },
  });

  return NextResponse.json(subject, { status: 201 });
}
