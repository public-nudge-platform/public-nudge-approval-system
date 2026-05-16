"use client";

import { useState, useMemo } from "react";
import { AUDIT_ACTION_LABEL, AUDIT_ACTION_COLOR } from "@/lib/constants";
import type { AuditAction } from "@prisma/client";
import { X, ChevronDown, ChevronUp } from "lucide-react";

type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  description: string;
  beforeData: unknown;
  afterData: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

type User = { id: string; name: string };

type Props = {
  logs: AuditLog[];
  users: User[];
};

const ENTITY_TYPE_OPTIONS = ["Request", "User", "Project", "Attachment"];

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  if (data == null) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700 whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function DetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{log.description}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {log.createdAt.toLocaleString("zh-TW")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">操作者</p>
              <p className="font-medium text-gray-800">{log.userName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">操作類型</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${AUDIT_ACTION_COLOR[log.action]}`}>
                {AUDIT_ACTION_LABEL[log.action]}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">操作對象類型</p>
              <p className="text-gray-700">{log.entityType}</p>
            </div>
            {log.entityId && (
              <div>
                <p className="text-xs text-gray-500">對象 ID</p>
                <p className="text-gray-600 text-xs font-mono break-all">{log.entityId}</p>
              </div>
            )}
            {log.ipAddress && (
              <div>
                <p className="text-xs text-gray-500">IP 位址</p>
                <p className="text-gray-700 font-mono text-xs">{log.ipAddress}</p>
              </div>
            )}
          </div>

          {(log.beforeData != null || log.afterData != null) && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <JsonViewer data={log.beforeData} label="變更前" />
              <JsonViewer data={log.afterData} label="變更後" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditLogsClient({ logs, users }: Props) {
  const [filterAction, setFilterAction] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [expandedLog, setExpandedLog] = useState<AuditLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterAction && log.action !== filterAction) return false;
      if (filterUserId && log.userId !== filterUserId) return false;
      if (filterEntityType && log.entityType !== filterEntityType) return false;
      if (filterFrom && log.createdAt < new Date(filterFrom)) return false;
      if (filterTo) {
        const to = new Date(filterTo);
        to.setHours(23, 59, 59, 999);
        if (log.createdAt > to) return false;
      }
      return true;
    });
  }, [logs, filterAction, filterUserId, filterEntityType, filterFrom, filterTo]);

  const activeFilterCount = [filterAction, filterUserId, filterEntityType, filterFrom, filterTo].filter(Boolean).length;

  function clearFilters() {
    setFilterAction("");
    setFilterUserId("");
    setFilterEntityType("");
    setFilterFrom("");
    setFilterTo("");
  }

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">篩選條件</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                清除
              </button>
            )}
            {showFilters ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </div>

        {showFilters && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="block text-xs text-gray-600 mb-1">操作類型</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-2.5 py-1.5 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全部</option>
                {(Object.keys(AUDIT_ACTION_LABEL) as AuditAction[]).map((a) => (
                  <option key={a} value={a}>{AUDIT_ACTION_LABEL[a]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">操作者</label>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-2.5 py-1.5 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全部</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">操作對象</label>
              <select
                value={filterEntityType}
                onChange={(e) => setFilterEntityType(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-2.5 py-1.5 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全部</option>
                {ENTITY_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">開始日期</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-2.5 py-1.5 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">結束日期</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-2.5 py-1.5 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-500 mb-2">共 {filtered.length} 筆紀錄</p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">操作者</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">操作類型</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">操作對象</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 hidden md:table-cell">描述</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">時間</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">
                  無紀錄
                </td>
              </tr>
            )}
            {filtered.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                onClick={() => setExpandedLog(log)}
              >
                <td className="px-5 py-3 font-medium text-gray-800">{log.userName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${AUDIT_ACTION_COLOR[log.action]}`}>
                    {AUDIT_ACTION_LABEL[log.action]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  <span>{log.entityType}</span>
                  {log.entityId && (
                    <span className="ml-1 font-mono text-gray-500">{log.entityId.slice(0, 8)}…</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-xs truncate">
                  {log.description}
                </td>
                <td className="px-5 py-3 text-right text-xs text-gray-500 whitespace-nowrap">
                  {log.createdAt.toLocaleString("zh-TW", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expandedLog && (
        <DetailModal log={expandedLog} onClose={() => setExpandedLog(null)} />
      )}
    </>
  );
}
