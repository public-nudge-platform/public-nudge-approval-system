"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { clsx } from "clsx";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { bulkApproveRequests } from "@/lib/actions/request";
import type { RequestStatus, RequestType } from "@prisma/client";

type Item = {
  id: string;
  stepId: string | null;
  requestNumber: string | null;
  type: RequestType;
  title: string;
  submitterName: string;
  amount: number;
  status: RequestStatus;
  neededBy: string | null;
  submittedAt: string | null;
};

export function BulkApprovalPanel({ items }: { items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectableItems = items.filter((i) => i.stepId);
  const allSelected = selectableItems.length > 0 && selectableItems.every((i) => selected.has(i.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableItems.map((i) => i.id)));
  }

  function handleBulkApprove() {
    const targets = items.filter((i) => selected.has(i.id) && i.stepId);
    if (targets.length === 0) return;

    startTransition(async () => {
      const result = await bulkApproveRequests(
        targets.map((i) => ({ requestId: i.id, stepId: i.stepId! })),
        comment.trim() || undefined
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const { successCount = 0, failCount = 0 } = result ?? {};
      if (failCount === 0) {
        toast.success(`已核准 ${successCount} 筆申請單`);
      } else {
        toast.warning(`已核准 ${successCount} 筆，${failCount} 筆失敗`);
      }
      setSelected(new Set());
      setComment("");
      setShowCommentBox(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {selectableItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              全選
            </label>
            <span className="text-xs text-gray-500">
              已選擇 {selected.size} / {selectableItems.length} 筆
            </span>
            <div className="flex-1" />
            {showCommentBox ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="簽核意見（選填，將套用至所有選取項目）"
                  className="flex-1 sm:w-64 text-xs text-gray-800 border border-blue-300 rounded-lg px-2.5 py-1.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  variant="primary"
                  size="sm"
                  loading={pending}
                  disabled={selected.size === 0}
                  onClick={handleBulkApprove}
                >
                  <CheckSquare size={13} />
                  確認核准 {selected.size} 筆
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCommentBox(false)} disabled={pending}>
                  取消
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => setShowCommentBox(true)}
              >
                <CheckSquare size={13} />
                批次核准（{selected.size}）
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((req) => (
          <div
            key={req.id}
            className={clsx(
              "flex items-stretch gap-2 bg-white rounded-xl border border-blue-200 transition-all hover:border-blue-400 hover:shadow-sm",
              selected.has(req.id) && "ring-2 ring-blue-400 border-blue-400"
            )}
          >
            {req.stepId && (
              <div className="flex items-center pl-4">
                <input
                  type="checkbox"
                  checked={selected.has(req.id)}
                  onChange={() => toggle(req.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            )}
            <Link
              href={`/requests/${req.id}?from=/approvals`}
              className={clsx(
                "flex flex-1 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4",
                !req.stepId && "pl-5"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <TypeBadge type={req.type} />
                  {req.requestNumber && (
                    <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                  )}
                </div>
                <p className="font-semibold text-gray-900 mt-1">{req.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{req.submitterName}</p>
                {req.neededBy && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    需款期限：{new Date(req.neededBy).toLocaleDateString("zh-TW")}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between flex-shrink-0 sm:flex-col sm:items-end sm:text-right">
                <div>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">
                    {req.amount.toLocaleString()} 元
                  </p>
                  {req.submittedAt && (
                    <p className="text-xs text-gray-400 mt-0.5 sm:text-right">
                      {new Date(req.submittedAt).toLocaleDateString("zh-TW")} 送出
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={req.status} />
                  <p className="text-xs text-gray-400">點擊進入詳情頁簽核</p>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
