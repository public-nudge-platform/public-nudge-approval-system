import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestId = formData.get("requestId") as string | null;

  if (!file || !requestId) return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "檔案超過 10MB" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "僅支援圖片與 PDF" }, { status: 400 });

  const request = await prisma.request.findUnique({ where: { id: requestId }, select: { submitterId: true } });
  if (!request) return NextResponse.json({ error: "找不到申請單" }, { status: 404 });

  const role = session.user.role;
  if (request.submitterId !== session.user.id && role !== "ADMIN") {
    return NextResponse.json({ error: "無上傳權限" }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await saveFile(buffer, requestId, file.name, file.type);

  const attachment = await prisma.attachment.create({
    data: { requestId, filename: file.name, url, mimeType: file.type, size: file.size },
  });

  return NextResponse.json({ attachment });
}
