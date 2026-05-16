import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileUrl } from "@/lib/storage";
import { logAuditAction } from "@/lib/audit";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
const REGULAR_ATTACHMENT_ALLOWED_STATUSES = new Set(["DRAFT", "WITHDRAWN", "RETURNED"]);
const SETTLEMENT_ATTACHMENT_ALLOWED_STATUSES = new Set(["PENDING_SETTLEMENT", "OFFSET_RETURNED"]);
const PAYMENT_ATTACHMENT_ALLOWED_STATUSES = new Set(["APPROVED"]);
const PAYMENT_UPLOAD_ROLES = new Set(["FINANCE", "ADMIN"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestId = formData.get("requestId") as string | null;
  const isSettlement = formData.get("isSettlement") === "true";
  const isPayment = formData.get("isPayment") === "true";

  if (!file || !requestId) return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "檔案超過 10MB" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "僅支援圖片與 PDF" }, { status: 400 });

  const request = await prisma.request.findUnique({ where: { id: requestId }, select: { submitterId: true, status: true } });
  if (!request) return NextResponse.json({ error: "找不到申請單" }, { status: 404 });

  if (isPayment) {
    if (!PAYMENT_UPLOAD_ROLES.has(session.user.role)) {
      return NextResponse.json({ error: "無上傳付款附件權限" }, { status: 403 });
    }
    if (!PAYMENT_ATTACHMENT_ALLOWED_STATUSES.has(request.status)) {
      return NextResponse.json({ error: "此狀態不可上傳付款附件" }, { status: 400 });
    }
  } else {
    if (request.submitterId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "無上傳權限" }, { status: 403 });
    }
    const allowedStatuses = isSettlement ? SETTLEMENT_ATTACHMENT_ALLOWED_STATUSES : REGULAR_ATTACHMENT_ALLOWED_STATUSES;
    if (!allowedStatuses.has(request.status)) {
      return NextResponse.json({ error: "此狀態不可上傳附件" }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const attachment = await prisma.attachment.create({
    data: {
      requestId,
      filename: file.name,
      url: "",
      mimeType: file.type,
      size: file.size,
      data: buffer,
      isSettlement,
      isPayment,
    },
  });

  const url = fileUrl(attachment.id);
  await prisma.attachment.update({ where: { id: attachment.id }, data: { url } });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "ATTACHMENT_UPLOADED",
    entityType: "Attachment",
    entityId: attachment.id,
    description: `上傳附件「${file.name}」${isPayment ? "（付款附件）" : ""}`,
    afterData: { filename: file.name, mimeType: file.type, size: file.size, requestId, isPayment },
  });

  return NextResponse.json({ attachment: { ...attachment, url, data: undefined } });
}
