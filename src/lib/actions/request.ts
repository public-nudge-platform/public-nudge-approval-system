"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RequestStatus, RequestType } from "@prisma/client";
import { createNotificationsForRoles, createNotificationsForUsers } from "@/lib/notifications";
import { logAuditAction } from "@/lib/audit";

type RequestItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  note?: string;
};

type CreateRequestInput = {
  type: RequestType;
  title: string;
  projectId?: string;
  description?: string;
  purpose?: string;
  neededBy?: string;
  paymentMethod?: string;
  recipientName?: string;
  bankName?: string;
  bankCode?: string;
  branchName?: string;
  branchCode?: string;
  paymentInfoNote?: string;
  items: RequestItemInput[];
  submit: boolean;
};

type UpdateRequestInput = CreateRequestInput;

const EDITABLE_STATUSES = new Set<RequestStatus>(["DRAFT", "WITHDRAWN", "RETURNED"]);

async function getNextApprovalStepOrder(requestId: string) {
  const lastStep = await prisma.approvalStep.findFirst({
    where: { requestId },
    orderBy: { stepOrder: "desc" },
    select: { stepOrder: true },
  });

  return (lastStep?.stepOrder ?? 0) + 1;
}

async function generateRequestNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${year}${month}`;

  const lastInMonth = await prisma.request.findFirst({
    where: { requestNumber: { startsWith: prefix } },
    orderBy: { requestNumber: "desc" },
  });

  let seq = 1;
  if (lastInMonth?.requestNumber) {
    const last = parseInt(lastInMonth.requestNumber.slice(-3), 10);
    seq = isNaN(last) ? 1 : last + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export async function createRequest(data: CreateRequestInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const totalAmount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  if (totalAmount <= 0) return { error: "金額必須大於 0" };
  if (data.items.length === 0) return { error: "請至少新增一個品項" };

  const requestNumber = data.submit ? await generateRequestNumber() : undefined;

  const request = await prisma.request.create({
    data: {
      type: data.type,
      title: data.title,
      projectId: data.projectId || null,
      description: data.description || null,
      purpose: data.purpose || null,
      neededBy: data.neededBy ? new Date(data.neededBy) : null,
      paymentMethod: data.paymentMethod || null,
      recipientName: data.recipientName || null,
      bankName: data.bankName || null,
      bankCode: data.bankCode || null,
      branchName: data.branchName || null,
      branchCode: data.branchCode || null,
      paymentInfoNote: data.paymentInfoNote || null,
      amount: totalAmount,
      status: data.submit ? "PENDING" : "DRAFT",
      requestNumber: requestNumber ?? null,
      submittedAt: data.submit ? new Date() : null,
      submitterId: session.user.id,
      items: {
        create: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          note: item.note || null,
        })),
      },
      ...(data.submit && {
        approvalSteps: {
          create: [{ stepOrder: 1, title: "理事長審核" }],
        },
      }),
    },
  });

  if (data.submit) {
    await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
      title: "新請款單待審核",
      message: `${session.user.name} 已送出「${data.title}」，請前往審核。`,
      type: "REQUEST_SUBMITTED",
      relatedRequestId: request.id,
    });
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "REQUEST_SUBMITTED",
      entityType: "Request",
      entityId: request.id,
      description: `送出請款單「${data.title}」`,
      afterData: { title: data.title, type: data.type, amount: totalAmount, status: "PENDING" },
    });
  } else {
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "REQUEST_CREATED",
      entityType: "Request",
      entityId: request.id,
      description: `新增請款單草稿「${data.title}」`,
      afterData: { title: data.title, type: data.type, amount: totalAmount, status: "DRAFT" },
    });
  }

  revalidatePath("/requests");
  revalidatePath("/dashboard");
  return { id: request.id };
}

export async function submitRequest(requestId: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const request = await prisma.request.findUnique({
    where: { id: requestId, submitterId: session.user.id },
  });
  if (!request) return { error: "找不到申請單" };
  if (!EDITABLE_STATUSES.has(request.status)) return { error: "此申請單不可送出" };

  const requestNumber = request.requestNumber ?? await generateRequestNumber();
  const nextStepOrder = await getNextApprovalStepOrder(requestId);

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "PENDING",
      requestNumber,
      submittedAt: new Date(),
      approvalSteps: {
        create: [{ stepOrder: nextStepOrder, title: "理事長審核" }],
      },
    },
  });

  await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
    title: "新請款單待審核",
    message: `${session.user.name} 已送出「${request.title}」，請前往審核。`,
    type: "REQUEST_SUBMITTED",
    relatedRequestId: requestId,
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "REQUEST_SUBMITTED",
    entityType: "Request",
    entityId: requestId,
    description: `送出請款單「${request.title}」`,
    beforeData: { status: request.status },
    afterData: { status: "PENDING", requestNumber },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  redirect(`/requests/${requestId}`);
}

export async function updateRequest(requestId: string, data: UpdateRequestInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const request = await prisma.request.findUnique({
    where: { id: requestId, submitterId: session.user.id },
    include: { items: true },
  });
  if (!request) return { error: "找不到申請單" };
  if (!EDITABLE_STATUSES.has(request.status)) return { error: "此申請單不可編輯" };

  const totalAmount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  if (totalAmount <= 0) return { error: "金額必須大於 0" };
  if (data.items.length === 0) return { error: "請至少新增一個品項" };

  const requestNumber = data.submit ? request.requestNumber ?? await generateRequestNumber() : request.requestNumber;
  const nextStepOrder = data.submit ? await getNextApprovalStepOrder(requestId) : null;

  await prisma.request.update({
    where: { id: requestId },
    data: {
      type: data.type,
      title: data.title,
      projectId: data.projectId || null,
      description: data.description || null,
      purpose: data.purpose || null,
      neededBy: data.neededBy ? new Date(data.neededBy) : null,
      paymentMethod: data.paymentMethod || null,
      recipientName: data.recipientName || null,
      bankName: data.bankName || null,
      bankCode: data.bankCode || null,
      branchName: data.branchName || null,
      branchCode: data.branchCode || null,
      paymentInfoNote: data.paymentInfoNote || null,
      amount: totalAmount,
      ...(data.submit && {
        status: "PENDING",
        requestNumber,
        submittedAt: new Date(),
        approvalSteps: {
          create: [{ stepOrder: nextStepOrder!, title: "理事長審核" }],
        },
      }),
      items: {
        deleteMany: {},
        create: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          note: item.note || null,
        })),
      },
    },
  });

  if (data.submit) {
    await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
      title: "請款單重新送出待審核",
      message: `${session.user.name} 已重新送出「${data.title}」，請前往審核。`,
      type: "REQUEST_SUBMITTED",
      relatedRequestId: requestId,
    });
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "REQUEST_SUBMITTED",
      entityType: "Request",
      entityId: requestId,
      description: `重新送出請款單「${data.title}」`,
      beforeData: { status: request.status, amount: Number(request.amount) },
      afterData: { status: "PENDING", amount: totalAmount, requestNumber },
    });
  } else {
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "REQUEST_UPDATED",
      entityType: "Request",
      entityId: requestId,
      description: `編輯請款單「${data.title}」`,
      beforeData: { status: request.status, amount: Number(request.amount) },
      afterData: { status: request.status, amount: totalAmount },
    });
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  return { id: requestId };
}

export async function withdrawRequest(requestId: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      status: true,
      submitterId: true,
      approvalSteps: { select: { id: true, records: { select: { id: true } } } },
    },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.submitterId !== session.user.id) return { error: "只有原申請人可以抽單" };
  if (request.status !== "PENDING") return { error: "只有待簽核申請可以抽單" };

  const hasApprovalRecord = request.approvalSteps.some((step) => step.records.length > 0);
  if (hasApprovalRecord) return { error: "已有簽核紀錄，無法抽單" };

  await prisma.$transaction(async (tx) => {
    await tx.approvalStep.deleteMany({
      where: { requestId, records: { none: {} } },
    });
    await tx.request.update({
      where: { id: requestId },
      data: { status: "WITHDRAWN" },
    });
  });

  await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
    title: "申請已被抽回",
    message: `${session.user.name} 已抽回「${request.title}」，暫不需簽核。`,
    type: "REQUEST_WITHDRAWN",
    relatedRequestId: requestId,
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "REQUEST_WITHDRAWN",
    entityType: "Request",
    entityId: requestId,
    description: `抽回請款單「${request.title}」`,
    beforeData: { status: "PENDING" },
    afterData: { status: "WITHDRAWN" },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function approveRequest(requestId: string, stepId: string, action: "APPROVED" | "REJECTED" | "RETURNED", comment?: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role;
  if (!["PRESIDENT", "FOUNDER_AGENT", "ADMIN"].includes(role)) {
    return { error: "無簽核權限" };
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      title: true,
      status: true,
      submitterId: true,
      approvalSteps: {
        where: { id: stepId },
        select: { records: { select: { id: true } } },
      },
    },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.status !== "PENDING") return { error: "此申請單不在待簽核狀態" };
  if (!request.approvalSteps[0] || request.approvalSteps[0].records.length > 0) {
    return { error: "此簽核步驟已處理" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalRecord.create({
      data: {
        stepId,
        approverId: session.user.id,
        action,
        comment: comment || null,
      },
    });

    const newStatus = action === "APPROVED" ? "APPROVED" : action === "REJECTED" ? "REJECTED" : "RETURNED";
    await tx.request.update({
      where: { id: requestId },
      data: { status: newStatus },
    });
  });

  const commentSuffix = comment ? `。備註：${comment}` : "";

  if (action === "APPROVED") {
    await createNotificationsForUsers([request.submitterId], {
      title: "請款單已核准",
      message: `您的申請「${request.title}」已核准，財務人員將盡快處理付款。`,
      type: "REQUEST_APPROVED",
      relatedRequestId: requestId,
    });
    await createNotificationsForRoles(["FINANCE", "ADMIN"], {
      title: "請款單待付款",
      message: `「${request.title}」已核准，請前往財務管理完成付款。`,
      type: "REQUEST_APPROVED",
      relatedRequestId: requestId,
    });
  } else if (action === "RETURNED") {
    await createNotificationsForUsers([request.submitterId], {
      title: "請款單已退回",
      message: `您的申請「${request.title}」已被退回，請修改後重新提交${commentSuffix}。`,
      type: "REQUEST_RETURNED",
      relatedRequestId: requestId,
    });
  } else if (action === "REJECTED") {
    await createNotificationsForUsers([request.submitterId], {
      title: "請款單已拒絕",
      message: `您的申請「${request.title}」已被拒絕${commentSuffix}。`,
      type: "REQUEST_REJECTED",
      relatedRequestId: requestId,
    });
  }

  const auditActionMap = {
    APPROVED: "REQUEST_APPROVED",
    RETURNED: "REQUEST_RETURNED",
    REJECTED: "REQUEST_REJECTED",
  } as const;
  const auditDescMap = {
    APPROVED: `核准請款單「${request.title}」`,
    RETURNED: `退回請款單「${request.title}」`,
    REJECTED: `拒絕請款單「${request.title}」`,
  };
  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: auditActionMap[action],
    entityType: "Request",
    entityId: requestId,
    description: auditDescMap[action],
    afterData: { action, ...(comment && { comment }) },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function returnApprovedRequest(requestId: string, comment?: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role;
  if (!["FINANCE", "ADMIN"].includes(role)) return { error: "無財務權限" };

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      title: true,
      status: true,
      paidAt: true,
      submitterId: true,
      approvalSteps: { orderBy: { stepOrder: "desc" }, take: 1, select: { stepOrder: true } },
    },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.status !== "APPROVED") return { error: "只能退回已核准且待付款的申請單" };
  if (request.paidAt) return { error: "已付款申請單不可退回修改" };

  const returnNote = comment?.trim() || "請補正請款資料後重新送出";

  await prisma.$transaction(async (tx) => {
    const step = await tx.approvalStep.create({
      data: {
        requestId,
        stepOrder: (request.approvalSteps[0]?.stepOrder ?? 0) + 1,
        title: "財務退回修改",
      },
    });
    await tx.approvalRecord.create({
      data: {
        stepId: step.id,
        approverId: session.user.id,
        action: "RETURNED",
        comment: returnNote,
      },
    });
    await tx.request.update({
      where: { id: requestId },
      data: { status: "RETURNED" },
    });
  });

  await createNotificationsForUsers([request.submitterId], {
    title: "請款單退回補正",
    message: `您的申請「${request.title}」已由財務退回，請補正資料後重新提交。備註：${returnNote}`,
    type: "REQUEST_RETURNED",
    relatedRequestId: requestId,
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "REQUEST_RETURNED",
    entityType: "Request",
    entityId: requestId,
    description: `財務退回請款單「${request.title}」`,
    beforeData: { status: "APPROVED" },
    afterData: { status: "RETURNED", comment: returnNote },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

type MarkAsPaidInput = {
  paymentMethod: string;
  paymentReference?: string;
  paymentNote?: string;
  paidAt?: string;
  bankLastFive?: string;
};

export async function markAsPaid(requestId: string, input: MarkAsPaidInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role;
  if (!["FINANCE", "ADMIN"].includes(role)) return { error: "無財務權限" };

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { status: true, title: true, submitterId: true, type: true },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.status !== "APPROVED") return { error: "只能標記已核准的申請單" };

  const newStatus = request.type === "PREPAID" ? "PENDING_SETTLEMENT" : "PAID";
  const paidBy = session.user.name || session.user.email;

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference || null,
      paymentNote: input.paymentNote || null,
      paidBy,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      bankLastFive: input.bankLastFive || null,
    },
  });

  await createNotificationsForUsers([request.submitterId], {
    title: "請款已付款",
    message: `您的申請「${request.title}」已完成付款。`,
    type: "PAYMENT_COMPLETED",
    relatedRequestId: requestId,
  });

  if (request.type === "PREPAID") {
    await createNotificationsForUsers([request.submitterId], {
      title: "預付款待沖銷",
      message: `您的預付請款「${request.title}」已付款，請上傳沖銷單據並填寫實際支出金額。`,
      type: "REIMBURSEMENT_REQUIRED",
      relatedRequestId: requestId,
    });
  }

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PAYMENT_MARKED",
    entityType: "Request",
    entityId: requestId,
    description: `標記付款「${request.title}」，方式：${input.paymentMethod}，付款人：${paidBy}`,
    afterData: {
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
      bankLastFive: input.bankLastFive,
      paidBy,
      newStatus,
    },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function submitSettlement(requestId: string, data: { actualAmount: number; reimbursementNote?: string }) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const request = await prisma.request.findUnique({
    where: { id: requestId, submitterId: session.user.id },
    select: { status: true, title: true, type: true },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.type !== "PREPAID") return { error: "只有預付請款需要沖銷" };
  if (request.status !== "PENDING_SETTLEMENT" && request.status !== "OFFSET_RETURNED") {
    return { error: "此申請單不在待沖銷或沖銷退回狀態" };
  }
  if (!data.actualAmount || data.actualAmount <= 0) return { error: "實際支出金額必須大於 0" };

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "OFFSET_SUBMITTED",
      actualAmount: data.actualAmount,
      reimbursementNote: data.reimbursementNote || null,
      reimbursementSubmittedAt: new Date(),
      offsetReviewNote: null,
    },
  });

  await createNotificationsForRoles(["FINANCE", "PRESIDENT", "FOUNDER_AGENT"], {
    title: "沖銷單據待確認",
    message: `${session.user.name} 已送出「${request.title}」的沖銷單據，請前往確認。`,
    type: "SETTLEMENT_SUBMITTED",
    relatedRequestId: requestId,
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "SETTLEMENT_SUBMITTED",
    entityType: "Request",
    entityId: requestId,
    description: `送出沖銷「${request.title}」`,
    afterData: { actualAmount: data.actualAmount, ...(data.reimbursementNote && { note: data.reimbursementNote }) },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function reviewSettlement(requestId: string, action: "APPROVED" | "RETURNED", comment?: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role;
  if (!["FINANCE", "PRESIDENT", "FOUNDER_AGENT", "ADMIN"].includes(role)) {
    return { error: "無沖銷審核權限" };
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { status: true, title: true, submitterId: true, type: true },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.type !== "PREPAID") return { error: "只有預付請款需要沖銷審核" };
  if (request.status !== "OFFSET_SUBMITTED") return { error: "此申請單不在沖銷待確認狀態" };

  if (action === "APPROVED") {
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "CLOSED",
        offsetReviewedAt: new Date(),
        offsetReviewedBy: session.user.name || session.user.email,
      },
    });

    await createNotificationsForUsers([request.submitterId], {
      title: "沖銷已確認完成",
      message: `您的預付請款「${request.title}」沖銷已確認完成，案件結案。`,
      type: "SETTLEMENT_APPROVED",
      relatedRequestId: requestId,
    });
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "SETTLEMENT_APPROVED",
      entityType: "Request",
      entityId: requestId,
      description: `沖銷完成「${request.title}」`,
      afterData: { status: "CLOSED" },
    });
  } else {
    const reviewNote = comment || "請補充沖銷單據後重新送出";
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "OFFSET_RETURNED",
        offsetReviewNote: reviewNote,
        reimbursementSubmittedAt: null,
      },
    });

    await createNotificationsForUsers([request.submitterId], {
      title: "沖銷退回補件",
      message: `您的預付請款「${request.title}」沖銷被退回，請補充單據後重新送出。備註：${reviewNote}`,
      type: "SETTLEMENT_RETURNED",
      relatedRequestId: requestId,
    });
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "SETTLEMENT_RETURNED",
      entityType: "Request",
      entityId: requestId,
      description: `沖銷退回「${request.title}」`,
      afterData: { note: reviewNote },
    });
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
