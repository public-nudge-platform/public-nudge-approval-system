"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Project = { id: string; name: string };

interface ExportButtonProps {
  projects: Project[];
  label?: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - 1 + i);
const MONTHS = [
  { value: "01", label: "1 月" }, { value: "02", label: "2 月" },
  { value: "03", label: "3 月" }, { value: "04", label: "4 月" },
  { value: "05", label: "5 月" }, { value: "06", label: "6 月" },
  { value: "07", label: "7 月" }, { value: "08", label: "8 月" },
  { value: "09", label: "9 月" }, { value: "10", label: "10 月" },
  { value: "11", label: "11 月" }, { value: "12", label: "12 月" },
];

export function ExportButton({ projects, label = "匯出 Excel" }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [monthNum, setMonthNum] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("project", projectId);
      if (startDate || endDate) {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      } else if (year && monthNum) {
        params.set("month", `${year}-${monthNum}`);
      }

      const res = await fetch(`/api/export/requests?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "匯出失敗" }));
        alert(err.error ?? "匯出失敗");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      let filename = "export.xlsx";
      const match = disposition.match(/filename\*=UTF-8''(.+)/i);
      if (match) filename = decodeURIComponent(match[1]);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Download size={14} />
        {label}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{label}</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">專案</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部專案</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">月份</label>
                <div className="flex gap-2">
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="flex-1 text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={String(y)}>{y} 年</option>
                    ))}
                  </select>
                  <select
                    value={monthNum}
                    onChange={(e) => setMonthNum(e.target.value)}
                    className="flex-1 text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">全部月份</option>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">若同時設定日期區間，以日期區間優先</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">日期區間</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">—</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={loading}>
                取消
              </Button>
              <Button variant="primary" size="sm" loading={loading} onClick={handleExport}>
                {!loading && <Download size={14} />}
                匯出
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
