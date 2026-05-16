"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";

const MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"];

export async function createPaymentRecipient(name: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!MANAGE_ROLES.includes(session.user.role as UserRole)) return { error: "無管理權限" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "名稱不可空白" };

  await prisma.paymentRecipient.create({ data: { name: trimmed } });
  revalidatePath("/admin/recipients");
}

export async function updatePaymentRecipient(id: string, name: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!MANAGE_ROLES.includes(session.user.role as UserRole)) return { error: "無管理權限" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "名稱不可空白" };

  await prisma.paymentRecipient.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/admin/recipients");
}

export async function togglePaymentRecipientActive(id: string, isActive: boolean) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!MANAGE_ROLES.includes(session.user.role as UserRole)) return { error: "無管理權限" };

  await prisma.paymentRecipient.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/recipients");
}
