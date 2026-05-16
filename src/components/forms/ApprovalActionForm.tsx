"use client";

import { useState, useTransition } from "react";
import { Check, X, RotateCcw, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { approveRequest } from "@/lib/actions/request";

type Props = {
  requestId: string;
  stepId: string;
};

export function ApprovalActionForm({ requestId, stepId }: Props) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(action: "APPROVED" | "REJECTED" | "RETURNED") {
    setError(null);
    startTransition(async () => {
      const result = await approveRequest(requestId, stepId, action, comment);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-2">
        <UserRoundCheck size={15} className="text-blue-600" />
        <p className="text-sm font-semibold text-gray-800">簽核操作</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          簽核意見（必填）
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="請輸入審核意見…"
          className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          onClick={() => handleAction("APPROVED")}
        >
          <Check size={13} />
          核准
        </Button>
        <Button
          variant="warning"
          size="sm"
          loading={isPending}
          onClick={() => handleAction("RETURNED")}
        >
          <RotateCcw size={13} />
          退回修改
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={isPending}
          onClick={() => handleAction("REJECTED")}
        >
          <X size={13} />
          拒絕
        </Button>
      </div>
    </div>
  );
}
