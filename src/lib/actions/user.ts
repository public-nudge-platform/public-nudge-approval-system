"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { logAuditAction } from "@/lib/audit";

const MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"];

// Roles a non-ADMIN manager can assign/manage
const NON_ADMIN_MANAGEABLE: UserRole[] = ["FINANCE", "DIRECTOR", "SUPERVISOR"];

function canManage(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "ADMIN") return true;
  if (["PRESIDENT", "FOUNDER_AGENT"].includes(actorRole)) {
    return NON_ADMIN_MANAGEABLE.includes(targetRole);
  }
  return false;
}

async function getActor() {
  const session = await auth();
  if (!session) return null;
  const role = session.user.role as UserRole;
  if (!MANAGE_ROLES.includes(role)) return null;
  return { id: session.user.id, name: session.user.name ?? session.user.email ?? "unknown", role };
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const actor = await getActor();
  if (!actor) return { error: "無權限" };

  if (!canManage(actor.role, data.role)) {
    return { error: "無法指定此角色" };
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return { error: "Email 已存在" };

  if (data.password.length < 6) return { error: "密碼至少 6 個字元" };

  const passwordHash = await bcrypt.hash(data.password, 12);

  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
    },
  });

  await logAuditAction({
    userId: actor.id,
    userName: actor.name,
    action: "USER_CREATED",
    entityType: "User",
    entityId: newUser.id,
    description: `新增使用者「${data.name}」`,
    afterData: { name: data.name, email: data.email, role: data.role },
  });

  revalidatePath("/admin/users");
}

export async function updateUser(userId: string, data: {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}) {
  const actor = await getActor();
  if (!actor) return { error: "無權限" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "找不到使用者" };

  if (!canManage(actor.role, target.role)) {
    return { error: "無法管理此使用者" };
  }
  if (!canManage(actor.role, data.role)) {
    return { error: "無法指定此角色" };
  }

  // Non-ADMIN cannot deactivate ADMIN
  if (actor.role !== "ADMIN" && target.role === "ADMIN" && !data.isActive) {
    return { error: "無法停用管理員帳號" };
  }

  // ADMIN cannot deactivate themselves
  if (actor.id === userId && !data.isActive) {
    return { error: "無法停用自己的帳號" };
  }

  const emailTaken = await prisma.user.findFirst({
    where: { email: data.email, NOT: { id: userId } },
  });
  if (emailTaken) return { error: "Email 已被其他帳號使用" };

  const wasActive = target.isActive;
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      isActive: data.isActive,
    },
  });

  const deactivated = wasActive && !data.isActive;
  await logAuditAction({
    userId: actor.id,
    userName: actor.name,
    action: deactivated ? "USER_DEACTIVATED" : "USER_UPDATED",
    entityType: "User",
    entityId: userId,
    description: deactivated
      ? `停用使用者「${target.name}」`
      : `編輯使用者「${target.name}」`,
    beforeData: { name: target.name, email: target.email, role: target.role, isActive: wasActive },
    afterData: { name: data.name, email: data.email, role: data.role, isActive: data.isActive },
  });

  revalidatePath("/admin/users");
}

export async function resetPassword(userId: string, newPassword: string) {
  const actor = await getActor();
  if (!actor) return { error: "無權限" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "找不到使用者" };

  if (!canManage(actor.role, target.role)) {
    return { error: "無法管理此使用者" };
  }

  if (newPassword.length < 6) return { error: "密碼至少 6 個字元" };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await logAuditAction({
    userId: actor.id,
    userName: actor.name,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: userId,
    description: `重設使用者「${target.name}」的密碼`,
  });

  revalidatePath("/admin/users");
}
