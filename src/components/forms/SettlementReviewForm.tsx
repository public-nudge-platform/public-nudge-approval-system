"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewSettlement } from "@/lib/actions/request";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, RotateCcw } from "lucide-react";

type Props = {
  requestId: string;
};

export function SettlementReviewForm({ requestId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  function handleAction(action: "APPROVED" | "RETURNED") {
    setError(null);
    startTransition(async () => {
      const result = await reviewSettlement(requestId, action, comment || undefined);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(action === "APPROVED" ? "沖銷已確認完成" : "已退回補件");
        router.refresh();
      }
    });
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <p className="text-green-600 font-medium text-sm">{success}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">確認沖銷</h3>

      <div>
        <label className="block text-xs text-gray-600 mb-1">審核意見（退回時建議填寫）</label>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="審核意見（選填）"
          className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => handleAction("APPROVED")}
          className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700"
        >
          <CheckCircle2 size={14} />
          {pending ? "處理中…" : "確認沖銷完成"}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => handleAction("RETURNED")}
          className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600"
        >
          <RotateCcw size={14} />
          {pending ? "處理中…" : "退回補件"}
        </Button>
      </div>
    </div>
  );
}
