"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RequestType } from "@prisma/client";

type RequestItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  note?: string;
};

type CreateRequestInput = {
  type: RequestType;
  title: string;
  projectName?: string;
  description?: string;
  purpose?: string;
  neededBy?: string;
  recipientName?: string;
  bankName?: string;
  bankAccount?: string;
  items: RequestItemInput[];
  submit: boolean;
};

async function generateRequestNumber(type: RequestType): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = type === "PREPAID" ? "AP" : "CL";
  const count = await prisma.request.count({ where: { type } });
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
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

  const requestNumber = data.submit ? await generateRequestNumber(data.type) : undefined;

  const request = await prisma.request.create({
    data: {
      type: data.type,
      title: data.title,
      projectName: data.projectName || null,
      description: data.description || null,
      purpose: data.purpose || null,
      neededBy: data.neededBy ? new Date(data.neededBy) : null,
      recipientName: data.recipientName || null,
      bankName: data.bankName || null,
      bankAccount: data.bankAccount || null,
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

  revalidatePath("/requests");
  revalidatePath("/dashboard");
  redirect(`/requests/${request.id}`);
}

export async function submitRequest(requestId: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const request = await prisma.request.findUnique({
    where: { id: requestId, submitterId: session.user.id },
  });
  if (!request) return { error: "找不到申請單" };
  if (request.status !== "DRAFT") return { error: "只能送出草稿" };

  const requestNumber = await generateRequestNumber(request.type);

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

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function markAsPaid(requestId: string, paymentMethod: string, bankAccount?: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const role = session.user.role;
  if (!["FINANCE", "ADMIN"].includes(role)) return { error: "無財務權限" };

  await prisma.request.update({
    where: { id: requestId, status: "APPROVED" },
    data: {
      status: "PAID",
      paymentMethod,
      bankAccount: bankAccount || null,
      paidAt: new Date(),
    },
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
}
