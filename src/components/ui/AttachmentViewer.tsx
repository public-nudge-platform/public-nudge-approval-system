"use client";

import { FileText, ImageIcon, File, Download, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteAttachment } from "@/lib/actions/attachment";

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
  if (mimeType.startsWith("image/")) return <ImageIcon size={20} className="text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText size={20} className="text-red-500" />;
  return <File size={20} className="text-gray-400" />;
}

function AttachmentCard({ attachment, canDelete }: { attachment: Attachment; canDelete: boolean }) {
  const isImage = attachment.mimeType.startsWith("image/");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`確定要刪除「${attachment.filename}」嗎？`)) return;
    startTransition(async () => {
      const result = await deleteAttachment(attachment.id);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <div className={`group relative border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-blue-300 hover:shadow-sm transition-all ${isPending ? "opacity-50" : ""}`}>
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" download>
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
      </a>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={attachment.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center shadow-sm border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={13} className="text-gray-600" />
        </a>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center shadow-sm border border-gray-200 hover:border-red-300 hover:text-red-500"
          >
            <Trash2 size={13} className="text-gray-600 hover:text-red-500" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AttachmentGrid({ attachments, canDelete = false }: { attachments: Attachment[]; canDelete?: boolean }) {
  if (attachments.length === 0) {
    return <p className="text-sm text-gray-400 py-2">無附件</p>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {attachments.map((a) => <AttachmentCard key={a.id} attachment={a} canDelete={canDelete} />)}
    </div>
  );
}
