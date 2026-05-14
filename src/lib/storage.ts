import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveFile(
  buffer: Buffer,
  requestId: string,
  originalName: string
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext).replace(/[^\w一-鿿-]/g, "_").slice(0, 50);
  const uid = crypto.randomUUID().split("-")[0];
  const stored = `${uid}-${base}${ext}`;

  const dir = path.join(UPLOAD_DIR, requestId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, stored), buffer);

  return `/uploads/${requestId}/${stored}`;
}

export async function deleteFile(url: string): Promise<void> {
  const relative = url.replace(/^\/uploads\//, "");
  const filepath = path.join(UPLOAD_DIR, relative);
  await fs.unlink(filepath).catch(() => {});
}
