"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Pencil, Trash2, XCircle, RotateCcw, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR } from "@/lib/constants";
import { createProject, updateProject, closeProject, reopenProject, deleteProject } from "@/lib/actions/project";
import type { ProjectStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  _count: { requests: number };
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export function ProjectsClient({ projects, canManage }: { projects: Project[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createProject(fd.get("name") as string);
      if (result?.error) { setError(result.error); return; }
      setShowCreate(false);
      refresh();
    });
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editProject) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateProject(editProject.id, fd.get("name") as string);
      if (result?.error) { setError(result.error); return; }
      setEditProject(null);
      refresh();
    });
  }

  async function handleClose(id: string) {
    startTransition(async () => {
      await closeProject(id);
      refresh();
    });
  }

  async function handleReopen(id: string) {
    startTransition(async () => {
      await reopenProject(id);
      refresh();
    });
  }

  async function handleDelete(project: Project) {
    if (project._count.requests > 0) {
      alert("此專案已有請款單，無法刪除，只能結案。");
      return;
    }
    if (!confirm(`確定要刪除「${project.name}」嗎？此操作無法還原。`)) return;
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (result?.error) { alert(result.error); return; }
      refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">專案管理</h1>
        {canManage && (
          <Button size="sm" onClick={() => { setError(null); setShowCreate(true); }}>
            <PlusCircle size={14} />
            新增專案
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {projects.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">尚無專案</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">專案名稱</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">狀態</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">請款筆數</th>
                {canManage && <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((proj) => (
                <tr key={proj.id} className={clsx("transition-colors hover:bg-gray-50/80", proj.status === "CLOSED" && "opacity-60")}>
                  <td className="px-5 py-3">
                    <span className="font-medium text-gray-900">{proj.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", PROJECT_STATUS_COLOR[proj.status])}>
                      {PROJECT_STATUS_LABEL[proj.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{proj._count.requests} 筆</td>
                  {canManage && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setError(null); setEditProject(proj); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="編輯名稱"
                          disabled={pending}
                        >
                          <Pencil size={14} />
                        </button>
                        {proj.status === "ACTIVE" ? (
                          <button
                            onClick={() => handleClose(proj.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            title="結案"
                            disabled={pending}
                          >
                            <XCircle size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReopen(proj.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="重新啟用"
                            disabled={pending}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(proj)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="刪除"
                          disabled={pending || proj._count.requests > 0}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">共 {projects.length} 個專案</p>

      {showCreate && (
        <Modal title="新增專案" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">專案名稱 <span className="text-red-500">*</span></label>
              <input name="name" autoFocus className={inputCls} placeholder="例：2026 年度行銷計畫" />
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowCreate(false)} size="sm">取消</Button>
              <Button variant="primary" type="submit" loading={pending} size="sm">新增</Button>
            </div>
          </form>
        </Modal>
      )}

      {editProject && (
        <Modal title="編輯專案名稱" onClose={() => setEditProject(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">專案名稱 <span className="text-red-500">*</span></label>
              <input name="name" autoFocus defaultValue={editProject.name} className={inputCls} />
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => setEditProject(null)} size="sm">取消</Button>
              <Button variant="primary" type="submit" loading={pending} size="sm">儲存</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
