"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ProjectStatus, UserRole } from "@prisma/client";
import { logAuditAction } from "@/lib/audit";

const MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"];

async function requireManageRole() {
  const session = await auth();
  if (!session) return null;
  const role = session.user.role as UserRole;
  if (!MANAGE_ROLES.includes(role)) return null;
  return session;
}

export async function createProject(name: string) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  if (!name.trim()) return { error: "請填寫專案名稱" };

  const existing = await prisma.project.findUnique({ where: { name: name.trim() } });
  if (existing) return { error: "專案名稱已存在" };

  const project = await prisma.project.create({ data: { name: name.trim(), status: "IN_PROGRESS" } });
  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PROJECT_CREATED",
    entityType: "Project",
    entityId: project.id,
    description: `新增專案「${name.trim()}」`,
    afterData: { name: name.trim() },
  });
  revalidatePath("/projects");
}

export async function updateProject(id: string, name: string) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  if (!name.trim()) return { error: "請填寫專案名稱" };

  const taken = await prisma.project.findFirst({ where: { name: name.trim(), NOT: { id } } });
  if (taken) return { error: "專案名稱已存在" };

  const before = await prisma.project.findUnique({ where: { id }, select: { name: true } });
  await prisma.project.update({ where: { id }, data: { name: name.trim() } });
  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PROJECT_UPDATED",
    entityType: "Project",
    entityId: id,
    description: `編輯專案名稱「${before?.name}」→「${name.trim()}」`,
    beforeData: { name: before?.name },
    afterData: { name: name.trim() },
  });
  revalidatePath("/projects");
}

export async function setProjectStatus(id: string, status: ProjectStatus) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  const before = await prisma.project.findUnique({ where: { id }, select: { name: true, status: true } });
  await prisma.project.update({ where: { id }, data: { status } });
  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PROJECT_STATUS_CHANGED",
    entityType: "Project",
    entityId: id,
    description: `專案「${before?.name}」狀態變更`,
    beforeData: { status: before?.status },
    afterData: { status },
  });
  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  const usageCount = await prisma.request.count({ where: { projectId: id } });
  if (usageCount > 0) return { error: "此專案已有請款單，無法刪除，只能結案" };

  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } });
  await prisma.project.delete({ where: { id } });
  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "PROJECT_DELETED",
    entityType: "Project",
    entityId: id,
    description: `刪除專案「${project?.name}」`,
    beforeData: { name: project?.name },
  });
  revalidatePath("/projects");
}
