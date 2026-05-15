"use client";

import { FileText, ImageIcon, File, Download, Trash2, X } from "lucide-react";
import { useTransition, useState } from "react";
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

function Lightbox({ url, filename, onClose }: { url: string; filename: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
      >
        <X size={18} className="text-white" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={filename}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <a
        href={url}
        download
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
      >
        <Download size={14} />
        下載
      </a>
    </div>
  );
}

function AttachmentCard({ attachment, canDelete }: { attachment: Attachment; canDelete: boolean }) {
  const isImage = attachment.mimeType.startsWith("image/");
  const isPdf = attachment.mimeType === "application/pdf";
  const [isPending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState(false);

  function handleDelete() {
    if (!confirm(`確定要刪除「${attachment.filename}」嗎？`)) return;
    startTransition(async () => {
      const result = await deleteAttachment(attachment.id);
      if (result?.error) alert(result.error);
    });
  }

  function handleClick() {
    if (isImage) {
      setLightbox(true);
    } else {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      {lightbox && (
        <Lightbox url={attachment.url} filename={attachment.filename} onClose={() => setLightbox(false)} />
      )}
      <div className={`group relative border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-blue-300 hover:shadow-sm transition-all ${isPending ? "opacity-50" : ""}`}>
        <button type="button" onClick={handleClick} className="w-full text-left">
          {isImage ? (
            <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.url} alt={attachment.filename} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-28 bg-gray-50 flex items-center justify-center">
              {isPdf
                ? <FileText size={28} className="text-red-400" />
                : <File size={28} className="text-gray-400" />}
            </div>
          )}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-gray-700 truncate">{attachment.filename}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatBytes(attachment.size)}</p>
          </div>
        </button>

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={attachment.url}
            download
            className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center shadow-sm border border-gray-200 hover:border-blue-300"
          >
            <Download size={13} className="text-gray-600" />
          </a>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center shadow-sm border border-gray-200 hover:border-red-300"
            >
              <Trash2 size={13} className="text-gray-600 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>
    </>
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
