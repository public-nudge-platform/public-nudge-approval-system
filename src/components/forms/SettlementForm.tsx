"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { submitSettlement } from "@/lib/actions/request";
import { Button } from "@/components/ui/Button";
import { UploadZone } from "@/components/ui/UploadZone";
import { Receipt, AlertCircle, Info, RotateCcw } from "lucide-react";

type Props = {
  requestId: string;
  prepaidAmount: number;
  settlementAttachmentsCount: number;
  status: "PENDING_SETTLEMENT" | "OFFSET_RETURNED";
  offsetReviewNote?: string | null;
};

export function SettlementForm({ requestId, prepaidAmount, settlementAttachmentsCount, status, offsetReviewNote }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [actualAmount, setActualAmount] = useState<string>("");

  const diff = actualAmount ? Number(actualAmount) - prepaidAmount : null;
  const amountStatus =
    diff === null ? null :
    diff === 0 ? { label: "金額相符", color: "text-green-600 bg-green-50 border-green-200" } :
    diff < 0 ? { label: `需繳回差額 ${Math.abs(diff).toLocaleString()} 元`, color: "text-amber-700 bg-amber-50 border-amber-200" } :
    { label: `超支 ${diff.toLocaleString()} 元，需另行請款`, color: "text-red-700 bg-red-50 border-red-200" };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const amount = Number(data.get("actualAmount"));
    const note = (data.get("reimbursementNote") as string) || undefined;

    startTransition(async () => {
      const result = await submitSettlement(requestId, { actualAmount: amount, reimbursementNote: note });
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <p className="text-green-600 font-medium text-sm">沖銷已送出，等待財務確認</p>
      </div>
    );
  }

  const isResubmit = status === "OFFSET_RETURNED";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={15} className="text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">
          {isResubmit ? "重新送出沖銷" : "送出沖銷"}
        </h3>
      </div>

      {isResubmit && offsetReviewNote && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700">
          <RotateCcw size={12} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-0.5">退回原因</p>
            <p>{offsetReviewNote}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
        <span className="text-gray-600">預付金額</span>
        <span className="font-semibold text-gray-900 tabular-nums">{prepaidAmount.toLocaleString()} 元</span>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">實際支出金額 <span className="text-red-500">*</span></label>
        <input
          type="number"
          name="actualAmount"
          required
          min={1}
          step={1}
          placeholder="請輸入實際支出金額"
          value={actualAmount}
          onChange={(e) => setActualAmount(e.target.value)}
          className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {amountStatus && (
          <div className={`mt-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${amountStatus.color} flex items-center gap-1.5`}>
            <Info size={12} />
            {amountStatus.label}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">沖銷說明</label>
        <textarea
          name="reimbursementNote"
          rows={3}
          placeholder="請說明實際支出情況（選填）"
          className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
      </div>

      <div>
        <p className="text-xs text-gray-600 mb-2">沖銷附件（發票、收據、付款證明）</p>
        <UploadZone requestId={requestId} isSettlement={true} />
        {settlementAttachmentsCount === 0 && (
          <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle size={11} />
            建議上傳沖銷附件後再送出
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "送出中…" : isResubmit ? "重新送出沖銷" : "送出沖銷"}
      </Button>
    </form>
  );
}
