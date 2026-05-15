// Files are stored directly in PostgreSQL (Attachment.data field).
// URL format: /api/files/{attachmentId}
// No external storage service required.

export function fileUrl(attachmentId: string): string {
  return `/api/files/${attachmentId}`;
}
