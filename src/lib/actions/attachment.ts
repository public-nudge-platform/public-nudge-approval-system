"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAuditAction } from "@/lib/audit";

const LOCKED = new Set(["APPROVED", "PAID", "CLOSED"]);

export async function deleteAttachment(attachmentId: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { request: { select: { id: true, status: true, submitterId: true } } },
  });

  if (!attachment) return { error: "找不到附件" };
  if (LOCKED.has(attachment.request.status)) return { error: "核准後不可刪除附件" };

  const role = session.user.role;
  if (attachment.request.submitterId !== session.user.id && role !== "ADMIN") {
    return { error: "無刪除權限" };
  }

  const meta = await prisma.attachment.findUnique({ where: { id: attachmentId }, select: { filename: true } });
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "ATTACHMENT_DELETED",
    entityType: "Attachment",
    entityId: attachmentId,
    description: `刪除附件「${meta?.filename}」`,
    beforeData: { filename: meta?.filename, requestId: attachment.request.id },
  });
  revalidatePath(`/requests/${attachment.request.id}`);
}
