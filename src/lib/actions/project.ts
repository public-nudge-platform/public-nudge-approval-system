"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";

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

  await prisma.project.create({ data: { name: name.trim() } });
  revalidatePath("/projects");
}

export async function updateProject(id: string, name: string) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  if (!name.trim()) return { error: "請填寫專案名稱" };

  const taken = await prisma.project.findFirst({ where: { name: name.trim(), NOT: { id } } });
  if (taken) return { error: "專案名稱已存在" };

  await prisma.project.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/projects");
}

export async function closeProject(id: string) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  await prisma.project.update({ where: { id }, data: { status: "CLOSED" } });
  revalidatePath("/projects");
}

export async function reopenProject(id: string) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  await prisma.project.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  const session = await requireManageRole();
  if (!session) return { error: "無權限" };

  const usageCount = await prisma.request.count({ where: { projectId: id } });
  if (usageCount > 0) return { error: "此專案已有請款單，無法刪除，只能結案" };

  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
}
