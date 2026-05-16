import { prisma } from "@/lib/prisma";
import { REQUEST_TYPE_LABEL } from "@/lib/constants";
import type { NotificationType, UserRole, RequestType } from "@prisma/client";
import { sendPushToUser } from "@/lib/push";

type NotificationData = {
  title: string;
  message: string;
  type: NotificationType;
  relatedRequestId?: string;
};

export async function createNotificationsForUsers(userIds: string[], data: NotificationData) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: data.title,
      message: data.message,
      type: data.type,
      relatedRequestId: data.relatedRequestId ?? null,
    })),
  });
  // Send push notifications non-blocking
  const url = data.relatedRequestId ? `/requests/${data.relatedRequestId}` : undefined;
  for (const userId of userIds) {
    sendPushToUser(userId, { title: data.title, body: data.message, url }).catch(() => {});
  }
}

export async function createNotificationsForRoles(roles: UserRole[], data: NotificationData) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true },
  });
  await createNotificationsForUsers(users.map((u) => u.id), data);
}

// Exclude specific user IDs from role-based notifications (e.g. the actor themselves)
export async function createNotificationsForRolesExcept(
  roles: UserRole[],
  excludeUserIds: string[],
  data: NotificationData,
) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true, id: { notIn: excludeUserIds } },
    select: { id: true },
  });
  await createNotificationsForUsers(users.map((u) => u.id), data);
}

export function fmtRequestInfo(req: {
  requestNumber: string | null;
  title: string;
  projectName: string | null;
  type: RequestType;
  amount: { toNumber?: () => number } | number;
}): string {
  const num = req.requestNumber ? `請款單 ${req.requestNumber}` : `「${req.title}」`;
  const typeLabel = REQUEST_TYPE_LABEL[req.type];
  const project = req.projectName ? `，專案：${req.projectName}` : "";
  const rawAmount = typeof req.amount === "number" ? req.amount : (req.amount.toNumber?.() ?? 0);
  const amount = rawAmount.toLocaleString("zh-TW");
  return `${num}（${typeLabel}${project}），金額：${amount} 元`;
}
