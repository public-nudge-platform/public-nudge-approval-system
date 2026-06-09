"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PaymentAdjustmentType, RequestStatus, UserRole } from "@prisma/client";
import {
  createNotificationsForRoles,
  createNotificationsForUsers,
} from "@/lib/notifications";
import { logAuditAction } from "@/lib/audit";
import { PAYMENT_ADJUSTMENT_TYPE_LABEL } from "@/lib/constants";

const ADJUSTMENT_ALLOWED_STATUSES = new Set<RequestStatus>([
  "PAID",
  "PENDING_SETTLEMENT",
  "OFFSET_SUBMITTED",
  "OFFSET_RETURNED",
  "CLOSED",
]);

const ADJUSTMENT_WRITE_ROLES = new Set<UserRole>(["FINANCE", "ADMIN"]);

export type AdjustmentInput = {
  type: PaymentAdjustmentType;
  amount: number;
  accountingSubjectId?: string;
  occurredAt: string;
  note?: string;
};

export async function createPaymentAdjustment(requestId: string, input: AdjustmentInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role as UserRole;
  if (!ADJUSTMENT_WRITE_ROLES.has(role)) return { error: "無操作權限" };

  if (!input.amount || input.amount <= 0) return { error: "金額必須大於 0" };

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { submitter: { select: { id: true, name: true } } },
  });

  if (!request) return { error: "找不到請款單" };
  if (!ADJUSTMENT_ALLOWED_STATUSES.has(request.status)) {
    return { error: "此請款單目前狀態不允許新增付款調整" };
  }

  const adjustment = await prisma.paymentAdjustment.create({
    data: {
      requestId,
      type: input.type,
      amount: input.amount,
      accountingSubjectId: input.accountingSubjectId || null,
      occurredAt: new Date(input.occurredAt),
      note: input.note || null,
      createdById: session.user.id,
    },
  });

  const typeLabel = PAYMENT_ADJUSTMENT_TYPE_LABEL[input.type];
  const reqNum = request.requestNumber ?? request.id;
  const isClosed = request.status === "CLOSED";

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PAYMENT_ADJUSTMENT_CREATED",
    entityType: "PaymentAdjustment",
    entityId: adjustment.id,
    description: `在請款單 ${reqNum} 新增付款調整：${typeLabel} ${Number(input.amount).toLocaleString()} 元${isClosed ? "（案件已沖銷）" : ""}`,
    afterData: {
      requestId,
      requestNumber: request.requestNumber,
      adjustmentId: adjustment.id,
      type: input.type,
      amount: Number(input.amount),
      accountingSubjectId: input.accountingSubjectId ?? null,
      occurredAt: input.occurredAt,
      note: input.note ?? null,
      requestStatus: request.status,
    },
  });

  const notifData = {
    title: "新增付款調整",
    message: `請款單 ${request.requestNumber ?? request.title} 新增付款調整：${typeLabel} ${Number(input.amount).toLocaleString()} 元。`,
    type: "PAYMENT_ADJUSTMENT_ADDED" as const,
    relatedRequestId: requestId,
  };

  await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], notifData);
  if (request.submitter.id !== session.user.id) {
    await createNotificationsForUsers([request.submitter.id], notifData);
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/finance");
  return { success: true };
}

export async function updatePaymentAdjustment(adjustmentId: string, input: AdjustmentInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role as UserRole;
  if (!ADJUSTMENT_WRITE_ROLES.has(role)) return { error: "無操作權限" };

  if (!input.amount || input.amount <= 0) return { error: "金額必須大於 0" };

  const existing = await prisma.paymentAdjustment.findUnique({
    where: { id: adjustmentId },
    include: {
      request: { select: { id: true, requestNumber: true } },
    },
  });

  if (!existing) return { error: "找不到付款調整紀錄" };

  const beforeData = {
    type: existing.type,
    amount: Number(existing.amount),
    accountingSubjectId: existing.accountingSubjectId,
    occurredAt: existing.occurredAt.toISOString(),
    note: existing.note,
  };

  await prisma.paymentAdjustment.update({
    where: { id: adjustmentId },
    data: {
      type: input.type,
      amount: input.amount,
      accountingSubjectId: input.accountingSubjectId || null,
      occurredAt: new Date(input.occurredAt),
      note: input.note || null,
      updatedById: session.user.id,
    },
  });

  const typeLabel = PAYMENT_ADJUSTMENT_TYPE_LABEL[input.type];
  const reqNum = existing.request.requestNumber ?? existing.request.id;

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PAYMENT_ADJUSTMENT_UPDATED",
    entityType: "PaymentAdjustment",
    entityId: adjustmentId,
    description: `在請款單 ${reqNum} 編輯付款調整：${typeLabel} ${Number(input.amount).toLocaleString()} 元`,
    beforeData,
    afterData: {
      type: input.type,
      amount: Number(input.amount),
      accountingSubjectId: input.accountingSubjectId ?? null,
      occurredAt: input.occurredAt,
      note: input.note ?? null,
    },
  });

  revalidatePath(`/requests/${existing.request.id}`);
  revalidatePath("/finance");
  return { success: true };
}

export async function deletePaymentAdjustment(adjustmentId: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role as UserRole;
  if (!ADJUSTMENT_WRITE_ROLES.has(role)) return { error: "無操作權限" };

  const existing = await prisma.paymentAdjustment.findUnique({
    where: { id: adjustmentId },
    include: {
      request: { select: { id: true, requestNumber: true } },
    },
  });

  if (!existing) return { error: "找不到付款調整紀錄" };

  await prisma.paymentAdjustment.delete({ where: { id: adjustmentId } });

  const typeLabel = PAYMENT_ADJUSTMENT_TYPE_LABEL[existing.type];
  const reqNum = existing.request.requestNumber ?? existing.request.id;

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PAYMENT_ADJUSTMENT_DELETED",
    entityType: "PaymentAdjustment",
    entityId: adjustmentId,
    description: `在請款單 ${reqNum} 刪除付款調整：${typeLabel} ${Number(existing.amount).toLocaleString()} 元`,
    beforeData: {
      requestId: existing.requestId,
      requestNumber: existing.request.requestNumber,
      type: existing.type,
      amount: Number(existing.amount),
      accountingSubjectId: existing.accountingSubjectId,
      occurredAt: existing.occurredAt.toISOString(),
      note: existing.note,
    },
  });

  revalidatePath(`/requests/${existing.request.id}`);
  revalidatePath("/finance");
  return { success: true };
}
