import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function saveFile(
  buffer: Buffer,
  requestId: string,
  originalName: string,
  mimeType: string
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext).replace(/[^\w一-鿿-]/g, "_").slice(0, 50);
  const uid = crypto.randomUUID().split("-")[0];
  const key = `uploads/${requestId}/${uid}-${base}${ext}`;

  await getClient().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function deleteFile(url: string): Promise<void> {
  const prefix = process.env.R2_PUBLIC_URL ?? "";
  const key = url.startsWith(prefix) ? url.slice(prefix.length + 1) : url;

  await getClient().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  }));
}
