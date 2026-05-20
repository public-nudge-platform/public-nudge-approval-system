"use client";

import { useState, useTransition } from "react";
import {
  PlusCircle, Pencil, Trash2,
  X, AlertCircle, ChevronRight, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR } from "@/lib/constants";
import { createProject, updateProject, setProjectStatus, deleteProject } from "@/lib/actions/project";
import type { ProjectStatus, RequestStatus, RequestType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

type RequestRow = {
  id: string;
  requestNumber: string | null;
  type: RequestType;
  title: string;
  amount: unknown; // Decimal serialised as string from server
  status: RequestStatus;
  requestDate: Date;
  paidAt: Date | null;
  submitter: { name: string };
  accountingSubject: { code: string; name: string } | null;
  finalAccountingSubject: { code: string; name: string } | null;
};

type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  _count: { requests: number };
  requests: RequestRow[];
};

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

// ── Request mini-table ─────────────────────────────────────────────────────
function RequestsTable({ requests, projectId, totalCount }: {
  requests: RequestRow[];
  projectId: string;
  totalCount: number;
}) {
  if (requests.length === 0) {
    return <p className="text-xs text-gray-400 px-5 py-4">此專案尚無請款單</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[680px]">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-4 py-2 text-left font-semibold text-gray-500">流水編號</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">類型</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">標題</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">申請人</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">金額</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">狀態</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">申請日期</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">申請科目</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">正式科目</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-500" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-2 font-mono text-gray-500">{req.requestNumber ?? "—"}</td>
                <td className="px-3 py-2"><TypeBadge type={req.type} /></td>
                <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={req.title}>{req.title}</td>
                <td className="px-3 py-2 text-gray-600">{req.submitter.name}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-800 tabular-nums">
                  {Number(req.amount).toLocaleString()} 元
                </td>
                <td className="px-3 py-2"><StatusBadge status={req.status} /></td>
                <td className="px-3 py-2 text-gray-500 tabular-nums">
                  {new Date(req.requestDate).toLocaleDateString("zh-TW")}
                </td>
                <td className="px-3 py-2 font-mono text-gray-500 text-xs max-w-[100px] truncate" title={req.accountingSubject ? `${req.accountingSubject.code} ${req.accountingSubject.name}` : ""}>
                  {req.accountingSubject ? `${req.accountingSubject.code}` : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 font-mono text-gray-500 text-xs max-w-[100px] truncate" title={req.finalAccountingSubject ? `${req.finalAccountingSubject.code} ${req.finalAccountingSubject.name}` : ""}>
                  {req.finalAccountingSubject ? (
                    <span className={req.finalAccountingSubject.code !== req.accountingSubject?.code ? "text-amber-600" : ""}>
                      {req.finalAccountingSubject.code}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/requests/${req.id}`}
                    className="inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    <ExternalLink size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalCount > 10 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">顯示最新 {requests.length} 筆，共 {totalCount} 筆</p>
          <Link
            href={`/projects/${projectId}/requests`}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            顯示更多 →
          </Link>
        </div>
      )}
      {totalCount <= 10 && totalCount > 0 && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">共 {totalCount} 筆</p>
        </div>
      )}
    </div>
  );
}

// ── Accordion row ──────────────────────────────────────────────────────────
function ProjectRow({
  project,
  isOpen,
  onToggle,
  canManage,
  pending,
  onEdit,
  onSetStatus,
  onDelete,
}: {
  project: Project;
  isOpen: boolean;
  onToggle: () => void;
  canManage: boolean;
  pending: boolean;
  onEdit: (p: Project) => void;
  onSetStatus: (id: string, status: ProjectStatus) => void;
  onDelete: (p: Project) => void;
}) {
  return (
    <div className={clsx("border-b border-gray-100 last:border-0", project.status === "CLOSED" && "opacity-70")}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50/80 transition-colors">
        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <ChevronRight
            size={16}
            className={clsx("flex-shrink-0 text-gray-400 transition-transform duration-150", isOpen && "rotate-90")}
          />
          <span className="font-medium text-gray-900 truncate">{project.name}</span>
          <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0", PROJECT_STATUS_COLOR[project.status])}>
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">{project._count.requests} 筆</span>
        </button>

        {/* Action buttons */}
        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Inline status selector */}
            <select
              value={project.status}
              onChange={(e) => onSetStatus(project.id, e.target.value as ProjectStatus)}
              disabled={pending}
              className="hidden sm:block text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-gray-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            >
              <option value="NOT_STARTED">尚未啟動</option>
              <option value="IN_PROGRESS">進行中</option>
              <option value="CLOSED">已結案</option>
            </select>
            <button
              onClick={() => onEdit(project)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="編輯名稱"
              disabled={pending}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(project)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="刪除"
              disabled={pending || project._count.requests > 0}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-gray-100 bg-gray-50/30">
          <RequestsTable
            requests={project.requests}
            projectId={project.id}
            totalCount={project._count.requests}
          />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function ProjectsClient({ projects, canManage }: { projects: Project[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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

  function handleDelete(project: Project) {
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
          projects.map((proj) => (
            <ProjectRow
              key={proj.id}
              project={proj}
              isOpen={openIds.has(proj.id)}
              onToggle={() => toggleOpen(proj.id)}
              canManage={canManage}
              pending={pending}
              onEdit={(p) => { setError(null); setEditProject(p); }}
              onSetStatus={(id, status) => startTransition(async () => { await setProjectStatus(id, status); refresh(); })}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <p className="text-xs text-gray-400">共 {projects.length} 個專案</p>

      {showCreate && (
        <Modal title="新增專案" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                專案名稱 <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">
                專案名稱 <span className="text-red-500">*</span>
              </label>
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
