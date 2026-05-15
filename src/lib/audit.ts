import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma, type AuditAction } from "@prisma/client";

type LogInput = {
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  description: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
};

export async function logAuditAction(input: LogInput): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0].trim() ??
      h.get("x-real-ip") ??
      null;
    const ua = h.get("user-agent") ?? null;

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        userName: input.userName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        description: input.description,
        ...(input.beforeData && { beforeData: input.beforeData as Prisma.InputJsonValue }),
        ...(input.afterData && { afterData: input.afterData as Prisma.InputJsonValue }),
        ipAddress: ip,
        userAgent: ua,
      },
    });
  } catch {
    // Non-critical — don't crash the main action
  }
}
