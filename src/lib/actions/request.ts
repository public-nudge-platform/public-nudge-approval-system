"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RequestStatus, RequestType, UserRole } from "@prisma/client";
import {
  createNotificationsForRoles,
  createNotificationsForUsers,
  createNotificationsForRolesExcept,
  fmtRequestInfo,
} from "@/lib/notifications";
import { logAuditAction } from "@/lib/audit";
import { USER_ROLE_LABEL } from "@/lib/constants";

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
  bankAccountNumber?: string;
  paymentInfoNote?: string;
  accountingSubjectId?: string;
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

  if (!data.title?.trim()) return { error: "標題為必填" };
  if (data.title.length > 100) return { error: "標題不可超過 100 字" };
  if (data.description && data.description.length > 2000) return { error: "說明不可超過 2000 字" };
  if (data.purpose && data.purpose.length > 2000) return { error: "支出用途不可超過 2000 字" };
  if (data.paymentInfoNote && data.paymentInfoNote.length > 500) return { error: "收款備註不可超過 500 字" };
  if (data.neededBy && isNaN(Date.parse(data.neededBy))) return { error: "需款日期格式不正確" };
  for (const item of data.items) {
    if (!item.description?.trim()) return { error: "品項說明為必填" };
    if (item.description.length > 200) return { error: "品項說明不可超過 200 字" };
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity)) return { error: "數量須為正整數" };
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) return { error: "單價須大於 0" };
    if (item.note && item.note.length > 200) return { error: "品項備註不可超過 200 字" };
  }

  const totalAmount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  if (totalAmount <= 0) return { error: "金額必須大於 0" };
  if (data.items.length === 0) return { error: "請至少新增一個品項" };

  const requestNumber = data.submit ? await generateRequestNumber() : undefined;

  let projectName: string | null = null;
  if (data.projectId) {
    const proj = await prisma.project.findUnique({ where: { id: data.projectId }, select: { name: true } });
    projectName = proj?.name ?? null;
  }

  const request = await prisma.request.create({
    data: {
      type: data.type,
      title: data.title,
      projectId: data.projectId || null,
      projectName: projectName,
      description: data.description || null,
      purpose: data.purpose || null,
      neededBy: data.neededBy ? new Date(data.neededBy) : null,
      paymentMethod: data.paymentMethod || null,
      recipientName: data.recipientName || null,
      bankName: data.bankName || null,
      bankCode: data.bankCode || null,
      branchName: data.branchName || null,
      branchCode: data.branchCode || null,
      bankAccountNumber: data.bankAccountNumber || null,
      paymentInfoNote: data.paymentInfoNote || null,
      accountingSubjectId: data.accountingSubjectId || null,
      finalAccountingSubjectId: data.accountingSubjectId || null,
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
    const info = fmtRequestInfo({ requestNumber: requestNumber ?? null, title: data.title, projectName, type: data.type, amount: totalAmount });
    await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
      title: "新請款單待審核",
      message: `${session.user.name} 送出了${info}，請前往審核。`,
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
    select: { title: true, status: true, requestNumber: true, projectName: true, type: true, amount: true },
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

  const info = fmtRequestInfo({ requestNumber, title: request.title, projectName: request.projectName, type: request.type, amount: request.amount });
  const isResubmit = request.status !== "DRAFT";
  await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
    title: isResubmit ? "請款單重新送出待審核" : "新請款單待審核",
    message: `${session.user.name} ${isResubmit ? "重新送出" : "送出了"}${info}，請前往審核。`,
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

  if (!data.title?.trim()) return { error: "標題為必填" };
  if (data.title.length > 100) return { error: "標題不可超過 100 字" };
  if (data.description && data.description.length > 2000) return { error: "說明不可超過 2000 字" };
  if (data.purpose && data.purpose.length > 2000) return { error: "支出用途不可超過 2000 字" };
  if (data.paymentInfoNote && data.paymentInfoNote.length > 500) return { error: "收款備註不可超過 500 字" };
  if (data.neededBy && isNaN(Date.parse(data.neededBy))) return { error: "需款日期格式不正確" };
  for (const item of data.items) {
    if (!item.description?.trim()) return { error: "品項說明為必填" };
    if (item.description.length > 200) return { error: "品項說明不可超過 200 字" };
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity)) return { error: "數量須為正整數" };
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) return { error: "單價須大於 0" };
    if (item.note && item.note.length > 200) return { error: "品項備註不可超過 200 字" };
  }

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

  let projectName = request.projectName;
  if (data.projectId && data.projectId !== request.projectId) {
    const proj = await prisma.project.findUnique({ where: { id: data.projectId }, select: { name: true } });
    projectName = proj?.name ?? null;
  } else if (!data.projectId) {
    projectName = null;
  }

  const requestNumber = data.submit ? request.requestNumber ?? await generateRequestNumber() : request.requestNumber;
  const nextStepOrder = data.submit ? await getNextApprovalStepOrder(requestId) : null;

  await prisma.request.update({
    where: { id: requestId },
    data: {
      type: data.type,
      title: data.title,
      projectId: data.projectId || null,
      projectName,
      description: data.description || null,
      purpose: data.purpose || null,
      neededBy: data.neededBy ? new Date(data.neededBy) : null,
      paymentMethod: data.paymentMethod || null,
      recipientName: data.recipientName || null,
      bankName: data.bankName || null,
      bankCode: data.bankCode || null,
      branchName: data.branchName || null,
      branchCode: data.branchCode || null,
      bankAccountNumber: data.bankAccountNumber || null,
      paymentInfoNote: data.paymentInfoNote || null,
      accountingSubjectId: data.accountingSubjectId || null,
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
    const info = fmtRequestInfo({ requestNumber: requestNumber ?? null, title: data.title, projectName, type: data.type, amount: totalAmount });
    await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
      title: "請款單重新送出待審核",
      message: `${session.user.name} 重新送出了${info}，請前往審核。`,
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
      requestNumber: true,
      projectName: true,
      type: true,
      amount: true,
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

  const info = fmtRequestInfo(request);
  await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
    title: "申請已被抽回",
    message: `${session.user.name} 已抽回${info}，暫不需簽核。`,
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

  const role = session.user.role as UserRole;
  if (!["PRESIDENT", "FOUNDER_AGENT", "ADMIN"].includes(role)) {
    return { error: "無簽核權限" };
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      title: true,
      status: true,
      submitterId: true,
      requestNumber: true,
      projectName: true,
      type: true,
      amount: true,
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

  const actorLabel = USER_ROLE_LABEL[role] ?? role;
  const actorDisplay = `${actorLabel} ${session.user.name || session.user.email}`;
  const commentSuffix = comment ? `。備註：${comment}` : "";
  const info = fmtRequestInfo(request);

  // Peer approval roles to notify (the other of PRESIDENT/FOUNDER_AGENT)
  const peerRoles: UserRole[] = role === "PRESIDENT"
    ? ["FOUNDER_AGENT"]
    : role === "FOUNDER_AGENT"
    ? ["PRESIDENT"]
    : ["PRESIDENT", "FOUNDER_AGENT"];

  if (action === "APPROVED") {
    await createNotificationsForUsers([request.submitterId], {
      title: "請款單已核准",
      message: `您的${info}已由${actorDisplay}核准，財務人員將盡快處理付款。`,
      type: "REQUEST_APPROVED",
      relatedRequestId: requestId,
    });
    await createNotificationsForRoles(["FINANCE"], {
      title: "請款單待付款",
      message: `${info}已由${actorDisplay}核准，請前往財務管理完成付款。`,
      type: "REQUEST_APPROVED",
      relatedRequestId: requestId,
    });
    // Notify peer approver
    await createNotificationsForRolesExcept(peerRoles, [session.user.id], {
      title: "請款單已完成簽核",
      message: `${info}已由${actorDisplay}核准，您不需再進行簽核。`,
      type: "REQUEST_APPROVED",
      relatedRequestId: requestId,
    });
  } else if (action === "RETURNED") {
    await createNotificationsForUsers([request.submitterId], {
      title: "請款單已退回",
      message: `您的${info}已由${actorDisplay}退回，請修改後重新提交${commentSuffix}。`,
      type: "REQUEST_RETURNED",
      relatedRequestId: requestId,
    });
    // Notify peer approver
    await createNotificationsForRolesExcept(peerRoles, [session.user.id], {
      title: "請款單已退回申請人",
      message: `${info}已由${actorDisplay}退回修改，您不需再進行簽核${commentSuffix}。`,
      type: "REQUEST_RETURNED",
      relatedRequestId: requestId,
    });
  } else if (action === "REJECTED") {
    await createNotificationsForUsers([request.submitterId], {
      title: "請款單已拒絕",
      message: `您的${info}已由${actorDisplay}拒絕${commentSuffix}。`,
      type: "REQUEST_REJECTED",
      relatedRequestId: requestId,
    });
    // Notify peer approver
    await createNotificationsForRolesExcept(peerRoles, [session.user.id], {
      title: "請款單已拒絕",
      message: `${info}已由${actorDisplay}拒絕${commentSuffix}。`,
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
      requestNumber: true,
      projectName: true,
      type: true,
      amount: true,
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

  const info = fmtRequestInfo(request);
  const financeDisplay = `財務 ${session.user.name || session.user.email}`;

  await createNotificationsForUsers([request.submitterId], {
    title: "請款單退回補正",
    message: `您的${info}已由${financeDisplay}退回，請補正資料後重新提交。備註：${returnNote}`,
    type: "REQUEST_RETURNED",
    relatedRequestId: requestId,
  });
  // Notify approval roles
  await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
    title: "請款單被財務退回修改",
    message: `${info}已由${financeDisplay}退回申請人補正，備註：${returnNote}`,
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

export async function updateFinalAccountingSubject(requestId: string, finalAccountingSubjectId: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role;
  if (!["FINANCE", "ADMIN"].includes(role)) return { error: "無修改正式會計科目權限" };

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      title: true,
      finalAccountingSubjectId: true,
      finalAccountingSubject: { select: { code: true, name: true } },
    },
  });
  if (!request) return { error: "找不到申請單" };

  const newSubject = await prisma.accountingSubject.findUnique({
    where: { id: finalAccountingSubjectId },
    select: { code: true, name: true },
  });
  if (!newSubject) return { error: "找不到會計科目" };

  await prisma.request.update({
    where: { id: requestId },
    data: { finalAccountingSubjectId },
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "ACCOUNTING_SUBJECT_CHANGED",
    entityType: "Request",
    entityId: requestId,
    description: `修改正式會計科目「${request.title}」`,
    beforeData: request.finalAccountingSubject
      ? { code: request.finalAccountingSubject.code, name: request.finalAccountingSubject.name }
      : undefined,
    afterData: { code: newSubject.code, name: newSubject.name },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/finance");
  return { ok: true };
}

type MarkAsPaidInput = {
  paymentMethod: string;
  paymentNote?: string;
  paidAt?: string;
  bankLastFive?: string;
  paymentRecipientName?: string;
  finalAccountingSubjectId?: string;
};

export async function markAsPaid(requestId: string, input: MarkAsPaidInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role;
  if (!["FINANCE", "ADMIN"].includes(role)) return { error: "無財務權限" };

  if (input.paidAt && isNaN(Date.parse(input.paidAt))) return { error: "付款日期格式不正確" };
  if (input.paymentNote && input.paymentNote.length > 500) return { error: "付款備註不可超過 500 字" };
  if (input.bankLastFive && !/^\d{1,5}$/.test(input.bankLastFive)) return { error: "帳號後五碼格式不正確" };

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      title: true,
      submitterId: true,
      type: true,
      requestNumber: true,
      projectName: true,
      amount: true,
    },
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
      paymentNote: input.paymentNote || null,
      paidBy,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      bankLastFive: input.bankLastFive || null,
      paymentRecipientName: input.paymentRecipientName || null,
      ...(input.finalAccountingSubjectId && { finalAccountingSubjectId: input.finalAccountingSubjectId }),
    },
  });

  const info = fmtRequestInfo(request);
  const financeDisplay = `財務 ${paidBy}`;

  await createNotificationsForUsers([request.submitterId], {
    title: "請款已付款",
    message: `您的${info}已由${financeDisplay}完成付款。`,
    type: "PAYMENT_COMPLETED",
    relatedRequestId: requestId,
  });

  if (request.type === "PREPAID") {
    await createNotificationsForUsers([request.submitterId], {
      title: "預付款待沖銷",
      message: `您的${info}已付款，請上傳沖銷單據並填寫實際支出金額。`,
      type: "REIMBURSEMENT_REQUIRED",
      relatedRequestId: requestId,
    });
    // Notify approval roles about payment
    await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
      title: "預付請款已付款，待沖銷",
      message: `${info}已由${financeDisplay}完成付款，等待申請人送出沖銷。`,
      type: "PAYMENT_COMPLETED",
      relatedRequestId: requestId,
    });
  } else {
    // REIMBURSEMENT type: paid = final/closed, notify all relevant roles
    await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
      title: "請款已付款結案",
      message: `${info}已由${financeDisplay}完成付款，案件結案。`,
      type: "REQUEST_CLOSED",
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
      bankLastFive: input.bankLastFive,
      paymentRecipientName: input.paymentRecipientName,
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
    select: {
      status: true,
      title: true,
      type: true,
      requestNumber: true,
      projectName: true,
      amount: true,
    },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.type !== "PREPAID") return { error: "只有預付請款需要沖銷" };
  if (request.status !== "PENDING_SETTLEMENT" && request.status !== "OFFSET_RETURNED") {
    return { error: "此申請單不在待沖銷或沖銷退回狀態" };
  }
  if (!data.actualAmount || data.actualAmount <= 0) return { error: "實際支出金額必須大於 0" };
  if (!Number.isFinite(data.actualAmount)) return { error: "實際支出金額格式不正確" };
  if (data.reimbursementNote && data.reimbursementNote.length > 2000) return { error: "沖銷說明不可超過 2000 字" };

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

  const info = fmtRequestInfo(request);
  await createNotificationsForRoles(["FINANCE", "PRESIDENT", "FOUNDER_AGENT"], {
    title: "沖銷單據待確認",
    message: `${session.user.name} 已送出${info}的沖銷單據，請前往確認。`,
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

  const role = session.user.role as UserRole;
  if (!["FINANCE", "PRESIDENT", "FOUNDER_AGENT", "ADMIN"].includes(role)) {
    return { error: "無沖銷審核權限" };
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      title: true,
      submitterId: true,
      type: true,
      requestNumber: true,
      projectName: true,
      amount: true,
    },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.type !== "PREPAID") return { error: "只有預付請款需要沖銷審核" };
  if (request.status !== "OFFSET_SUBMITTED") return { error: "此申請單不在沖銷待確認狀態" };

  const roleLabel = USER_ROLE_LABEL[role] ?? role;
  const reviewerDisplay = `${roleLabel} ${session.user.name || session.user.email}`;
  const otherOffsetRoles = (["FINANCE", "PRESIDENT", "FOUNDER_AGENT"] as const).filter(r => r !== role);
  const info = fmtRequestInfo(request);

  if (action === "APPROVED") {
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "CLOSED",
        offsetReviewedAt: new Date(),
        offsetReviewedBy: reviewerDisplay,
      },
    });

    // Notify the confirming reviewer's peers
    await createNotificationsForRolesExcept(
      otherOffsetRoles as UserRole[],
      [session.user.id],
      {
        title: "沖銷已確認，案件結案",
        message: `${info}的沖銷已由${reviewerDisplay}完成確認，案件結案。`,
        type: "REQUEST_CLOSED",
        relatedRequestId: requestId,
      },
    );
    await createNotificationsForUsers([request.submitterId], {
      title: "沖銷已確認完成，案件結案",
      message: `您的${info}沖銷已由${reviewerDisplay}完成確認，案件結案。`,
      type: "REQUEST_CLOSED",
      relatedRequestId: requestId,
    });
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "SETTLEMENT_APPROVED",
      entityType: "Request",
      entityId: requestId,
      description: `沖銷完成「${request.title}」，確認人：${reviewerDisplay}`,
      afterData: { status: "CLOSED", reviewedBy: reviewerDisplay, role },
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

    await createNotificationsForRolesExcept(
      otherOffsetRoles as UserRole[],
      [session.user.id],
      {
        title: "沖銷已退回補件",
        message: `${info}的沖銷已由${reviewerDisplay}退回補件。`,
        type: "SETTLEMENT_RETURNED",
        relatedRequestId: requestId,
      },
    );
    await createNotificationsForUsers([request.submitterId], {
      title: "沖銷退回補件",
      message: `您的${info}沖銷被${reviewerDisplay}退回，請補充單據後重新送出。備註：${reviewNote}`,
      type: "SETTLEMENT_RETURNED",
      relatedRequestId: requestId,
    });
    await logAuditAction({
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "unknown",
      action: "SETTLEMENT_RETURNED",
      entityType: "Request",
      entityId: requestId,
      description: `沖銷退回「${request.title}」，操作人：${reviewerDisplay}`,
      afterData: { note: reviewNote, reviewedBy: reviewerDisplay, role },
    });
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
