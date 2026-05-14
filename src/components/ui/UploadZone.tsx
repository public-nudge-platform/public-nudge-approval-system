"use client";

import { Upload, X, FileText, Image } from "lucide-react";
import { useState } from "react";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadZone() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(newFiles: FileList) {
    Array.from(newFiles).forEach((file) => {
      const id = crypto.randomUUID();
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFiles((prev) => [...prev, { id, name: file.name, size: file.size, type: file.type, preview: e.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setFiles((prev) => [...prev, { id, name: file.name, size: file.size, type: file.type }]);
      }
    });
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
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
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>
        </p>
        <p className="text-xs text-gray-400 mt-1">支援圖片、PDF、Office 文件，單檔最大 10MB</p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {files.map((file) => (
            <div key={file.id} className="relative group border border-gray-200 rounded-lg overflow-hidden bg-white">
              {file.preview ? (
                <div className="h-20 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center bg-gray-50">
                  {file.type === "application/pdf" ? (
                    <FileText size={24} className="text-red-400" />
                  ) : (
                    <Image size={24} className="text-gray-300" />
                  )}
                </div>
              )}
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
