import { FileText, Image, File, Download } from "lucide-react";

type Attachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image size={20} className="text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText size={20} className="text-red-500" />;
  return <File size={20} className="text-gray-400" />;
}

export function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType.startsWith("image/");

  return (
    <div className="group relative border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-blue-300 hover:shadow-sm transition-all">
      {isImage ? (
        <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt={attachment.filename} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-28 bg-gray-50 flex items-center justify-center">
          <AttachmentIcon mimeType={attachment.mimeType} />
        </div>
      )}
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-gray-700 truncate">{attachment.filename}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatBytes(attachment.size)}</p>
      </div>
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-gray-200"
      >
        <Download size={13} className="text-gray-600" />
      </a>
    </div>
  );
}

export function AttachmentGrid({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return <p className="text-sm text-gray-400 py-2">無附件</p>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {attachments.map((a) => <AttachmentCard key={a.id} attachment={a} />)}
    </div>
  );
}
