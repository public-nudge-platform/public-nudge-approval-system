import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { data: true, mimeType: true, filename: true, requestId: true },
  });

  if (!attachment?.data) return new NextResponse("Not Found", { status: 404 });

  const role = session.user.role as UserRole;
  if (!FINANCE_ROLES.includes(role) && role !== "ADMIN") {
    const parentRequest = await prisma.request.findUnique({
      where: { id: attachment.requestId },
      select: { submitterId: true },
    });
    if (parentRequest?.submitterId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return new NextResponse(attachment.data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
