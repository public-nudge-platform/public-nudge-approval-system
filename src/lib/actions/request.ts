"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RequestType } from "@prisma/client";
import { createNotificationsForRoles, createNotificationsForUsers } from "@/lib/notifications";

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
  if (request.status !== "DRAFT") return { error: "只能送出草稿" };

  const requestNumber = await generateRequestNumber();

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "PENDING",
      requestNumber,
      submittedAt: new Date(),
      approvalSteps: {
        create: [{ stepOrder: 1, title: "理事長審核" }],
      },
    },
  });

  await createNotificationsForRoles(["PRESIDENT", "FOUNDER_AGENT"], {
    title: "新請款單待審核",
    message: `${session.user.name} 已送出「${request.title}」，請前往審核。`,
    type: "REQUEST_SUBMITTED",
    relatedRequestId: requestId,
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  redirect(`/requests/${requestId}`);
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
    select: { title: true, submitterId: true },
  });
  if (!request) return { error: "找不到申請單" };

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

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

type MarkAsPaidInput = {
  paymentMethod: string;
  paymentReference?: string;
  paymentNote?: string;
  paidAt?: string;
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

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "PAID",
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference || null,
      paymentNote: input.paymentNote || null,
      paidBy: session.user.name || session.user.email,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
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
      title: "預付款待核銷",
      message: `您的預付請款「${request.title}」已付款，請提交核銷單據。`,
      type: "REIMBURSEMENT_REQUIRED",
      relatedRequestId: requestId,
    });
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
