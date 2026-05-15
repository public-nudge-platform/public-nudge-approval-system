import { prisma } from "@/lib/prisma";
import type { NotificationType, UserRole } from "@prisma/client";

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
}

export async function createNotificationsForRoles(roles: UserRole[], data: NotificationData) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true },
  });
  await createNotificationsForUsers(users.map((u) => u.id), data);
}
