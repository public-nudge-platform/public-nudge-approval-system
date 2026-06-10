"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";

const MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"];

type PaymentRecipientInput = {
  name: string;
  bankName?: string;
  bankCode?: string;
  branchName?: string;
  branchCode?: string;
  bankAccountNumber?: string;
  paymentInfoNote?: string;
};

function normalizeRecipientInput(input: PaymentRecipientInput) {
  return {
    name: input.name.trim(),
    bankName: input.bankName?.trim() || null,
    bankCode: input.bankCode?.trim() || null,
    branchName: input.branchName?.trim() || null,
    branchCode: input.branchCode?.trim() || null,
    bankAccountNumber: input.bankAccountNumber?.trim() || null,
    paymentInfoNote: input.paymentInfoNote?.trim() || null,
  };
}

export async function createPaymentRecipient(input: PaymentRecipientInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!MANAGE_ROLES.includes(session.user.role as UserRole)) return { error: "無管理權限" };

  const data = normalizeRecipientInput(input);
  if (!data.name) return { error: "名稱不可空白" };

  await prisma.paymentRecipient.create({ data });
  revalidatePath("/admin/recipients");
}

// Any authenticated user can save a recipient from the request form
export async function saveRecipientFromForm(input: PaymentRecipientInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const data = normalizeRecipientInput(input);
  if (!data.name) return { error: "名稱不可空白" };

  await prisma.paymentRecipient.create({ data });
  revalidatePath("/admin/recipients");
  return { success: true };
}

export async function updatePaymentRecipient(id: string, input: PaymentRecipientInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!MANAGE_ROLES.includes(session.user.role as UserRole)) return { error: "無管理權限" };

  const data = normalizeRecipientInput(input);
  if (!data.name) return { error: "名稱不可空白" };

  await prisma.paymentRecipient.update({ where: { id }, data });
  revalidatePath("/admin/recipients");
}

export async function togglePaymentRecipientActive(id: string, isActive: boolean) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!MANAGE_ROLES.includes(session.user.role as UserRole)) return { error: "無管理權限" };

  await prisma.paymentRecipient.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/recipients");
}
