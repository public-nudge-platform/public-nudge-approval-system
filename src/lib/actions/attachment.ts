"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";

const LOCKED = new Set(["APPROVED", "PAID", "CLOSED"]);

export async function deleteAttachment(attachmentId: string) {
  const session = await auth();
  if (!session) return { error: "未登入" };

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { request: { select: { id: true, status: true, submitterId: true } } },
  });

  if (!attachment) return { error: "找不到附件" };
  if (LOCKED.has(attachment.request.status)) return { error: "核准後不可刪除附件" };

  const role = session.user.role;
  if (attachment.request.submitterId !== session.user.id && role !== "ADMIN") {
    return { error: "無刪除權限" };
  }

  await deleteFile(attachment.url);
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/requests/${attachment.request.id}`);
}
