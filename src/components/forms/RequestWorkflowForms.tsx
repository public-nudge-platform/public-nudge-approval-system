"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { returnApprovedRequest, withdrawRequest } from "@/lib/actions/request";

export function WithdrawRequestForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleWithdraw() {
    if (!window.confirm("確定要抽回這張申請單嗎？抽回後可編輯並重新送出。")) return;
    setError(null);
    startTransition(async () => {
      const result = await withdrawRequest(requestId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Undo2 size={15} className="text-slate-600" />
        <p className="text-sm font-semibold text-gray-800">申請人操作</p>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button variant="secondary" loading={pending} onClick={handleWithdraw} className="w-full justify-center">
        <Undo2 size={13} />
        抽單
      </Button>
    </div>
  );
}

export function FinanceReturnForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReturn() {
    setError(null);
    startTransition(async () => {
      const result = await returnApprovedRequest(requestId, comment);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <RotateCcw size={15} className="text-amber-600" />
        <p className="text-sm font-semibold text-gray-800">退回修改</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">退回原因</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="請說明需補正的資料…"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button variant="warning" loading={pending} onClick={handleReturn} className="w-full justify-center">
        <RotateCcw size={13} />
        退回修改
      </Button>
    </div>
  );
}
