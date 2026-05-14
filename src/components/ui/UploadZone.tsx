"use client";

import { Upload, X, FileText, ImageIcon, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type FileEntry = {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Props = {
  requestId?: string;
  onFilesChange?: (files: File[]) => void;
};

export function UploadZone({ requestId, onFilesChange }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  const uploadFile = useCallback(async (entry: FileEntry) => {
    if (!requestId) return;
    setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "uploading" } : e));

    const fd = new FormData();
    fd.append("file", entry.file);
    fd.append("requestId", requestId);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();

    if (!res.ok) {
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "error", error: json.error } : e));
    } else {
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "done" } : e));
      router.refresh();
    }
  }, [requestId, router]);

  function addFiles(fileList: FileList) {
    const newEntries: FileEntry[] = [];

    Array.from(fileList).forEach((file) => {
      const id = crypto.randomUUID();
      const entry: FileEntry = { id, file, status: "pending" };

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setEntries((prev) => prev.map((en) => en.id === id ? { ...en, preview: e.target?.result as string } : en));
        };
        reader.readAsDataURL(file);
      }

      newEntries.push(entry);
    });

    setEntries((prev) => {
      const updated = [...prev, ...newEntries];
      onFilesChange?.(updated.map((e) => e.file));
      return updated;
    });

    if (requestId) {
      newEntries.forEach((entry) => uploadFile(entry));
    }
  }

  function removeEntry(id: string) {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      onFilesChange?.(updated.map((e) => e.file));
      return updated;
    });
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"}`}
      >
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          拖曳檔案至此，或{" "}
          <label className="text-blue-600 cursor-pointer hover:underline">
            點此選擇
            <input
              type="file"
              className="sr-only"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>
        </p>
        <p className="text-xs text-gray-400 mt-1">支援圖片、PDF，單檔最大 10MB</p>
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {entries.map((entry) => (
            <div key={entry.id} className="relative group border border-gray-200 rounded-lg overflow-hidden bg-white">
              {entry.preview ? (
                <div className="h-20 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.preview} alt={entry.file.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center bg-gray-50">
                  {entry.file.type === "application/pdf"
                    ? <FileText size={24} className="text-red-400" />
                    : <ImageIcon size={24} className="text-gray-300" />}
                </div>
              )}
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-gray-700 truncate">{entry.file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(entry.file.size)}</p>
                {entry.status === "error" && (
                  <p className="text-xs text-red-500 truncate">{entry.error}</p>
                )}
              </div>
              {entry.status === "uploading" && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 size={20} className="text-blue-500 animate-spin" />
                </div>
              )}
              {entry.status !== "uploading" && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
