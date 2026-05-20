"use client";

import { useState, useTransition } from "react";
import { BookOpen, Plus, Search, Pencil, X, Check, Power } from "lucide-react";

type Subject = {
  id: string;
  code: string;
  name: string;
  direction: string;
  isActive: boolean;
};

type Mode = "list" | "new" | "edit";

export function AccountingSubjectsClient({ subjects: initial }: { subjects: Subject[] }) {
  const [subjects, setSubjects] = useState<Subject[]>(initial);
  const [q, setQ] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [mode, setMode] = useState<Mode>("list");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ code: "", name: "", direction: "借", isActive: true });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = subjects.filter((s) => {
    const matchQ = !q || s.code.includes(q) || s.name.includes(q);
    const matchActive =
      filterActive === "" ? true : filterActive === "true" ? s.isActive : !s.isActive;
    return matchQ && matchActive;
  });

  function openNew() {
    setForm({ code: "", name: "", direction: "借", isActive: true });
    setEditing(null);
    setError(null);
    setMode("new");
  }

  function openEdit(s: Subject) {
    setForm({ code: s.code, name: s.name, direction: s.direction, isActive: s.isActive });
    setEditing(s);
    setError(null);
    setMode("edit");
  }

  function handleSave() {
    if (!form.code.trim()) { setError("代號為必填"); return; }
    if (!form.name.trim()) { setError("名稱為必填"); return; }

    startTransition(async () => {
      setError(null);
      try {
        if (mode === "new") {
          const res = await fetch("/api/accounting-subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const data = await res.json();
          if (!res.ok) { setError(data.error ?? "建立失敗"); return; }
          setSubjects((prev) => [...prev, data].sort((a, b) => a.code.localeCompare(b.code)));
        } else if (mode === "edit" && editing) {
          const res = await fetch(`/api/accounting-subjects/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const data = await res.json();
          if (!res.ok) { setError(data.error ?? "更新失敗"); return; }
          setSubjects((prev) => prev.map((s) => s.id === editing.id ? data : s).sort((a, b) => a.code.localeCompare(b.code)));
        }
        setMode("list");
      } catch {
        setError("網路錯誤");
      }
    });
  }

  function handleToggleActive(s: Subject) {
    startTransition(async () => {
      const res = await fetch(`/api/accounting-subjects/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects((prev) => prev.map((x) => x.id === s.id ? data : x));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-teal-600" />
          <h1 className="text-xl font-semibold text-gray-900">會計科目管理</h1>
        </div>
        {mode === "list" && (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
            新增科目
          </button>
        )}
      </div>

      {/* New / Edit Form */}
      {(mode === "new" || mode === "edit") && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">
            {mode === "new" ? "新增會計科目" : `編輯：${editing?.code} ${editing?.name}`}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                代號 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="例：5805"
                className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">借/貸</label>
              <select
                value={form.direction}
                onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="借">借</option>
                <option value="貸">貸</option>
                <option value="">—</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              名稱 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例：專案支出-講師費"
              className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-slate-300"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">啟用（可被請款單選取）</label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Check size={14} />
              {isPending ? "儲存中…" : "儲存"}
            </button>
            <button
              onClick={() => { setMode("list"); setError(null); }}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X size={14} />
              取消
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {mode === "list" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48 max-w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋代號或名稱…"
              className="w-full pl-8 pr-3 py-1.5 text-sm text-gray-800 border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}
            className="text-sm text-gray-700 border border-slate-300 rounded-lg px-3 py-1.5 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部狀態</option>
            <option value="true">啟用中</option>
            <option value="false">已停用</option>
          </select>
        </div>
      )}

      {/* Table */}
      {mode === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">找不到符合條件的科目</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">代號</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">名稱</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">借/貸</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">啟用</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className={`hover:bg-gray-50/80 transition-colors ${!s.isActive ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-mono text-gray-700">{s.code}</td>
                      <td className="px-4 py-3 text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.direction || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {s.isActive ? "啟用" : "停用"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="編輯"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(s)}
                            disabled={isPending}
                            className={`p-1.5 rounded-lg transition-colors ${
                              s.isActive
                                ? "text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                                : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                            }`}
                            title={s.isActive ? "停用" : "啟用"}
                          >
                            <Power size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-gray-500">共 {filtered.length} 筆</p>
    </div>
  );
}
