"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X, Banknote } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { bulkMarkAsPaid } from "@/lib/actions/request";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";

type Recipient = { id: string; name: string };
type FinancialAccount = { id: string; name: string };

export function BulkMarkPaidModal({
  requestIds,
  recipients = [],
  financialAccounts = [],
  onClose,
  onDone,
}: {
  requestIds: string[];
  recipients?: Recipient[];
  financialAccounts?: FinancialAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [recipientValue, setRecipientValue] = useState("");
  const [customRecipient, setCustomRecipient] = useState("");
  const [bankLastFive, setBankLastFive] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!paymentMethod) {
      setError("請選擇付款方式");
      return;
    }

    const paymentRecipientName =
      recipientValue === "OTHER" ? customRecipient.trim() : recipientValue || undefined;

    startTransition(async () => {
      const result = await bulkMarkAsPaid(requestIds, {
        paymentMethod,
        paymentNote: paymentNote.trim() || undefined,
        paidAt: paidAt || undefined,
        bankLastFive: bankLastFive.trim() || undefined,
        paymentRecipientName,
        financialAccountId: financialAccountId || undefined,
      });
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      const { successCount = 0, failCount = 0 } = result ?? {};
      if (failCount === 0) {
        toast.success(`已標記 ${successCount} 筆申請單為已付款`);
      } else {
        toast.warning(`已標記 ${successCount} 筆，${failCount} 筆失敗`);
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !pending && onClose()} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">
              批次標記已付款（{requestIds.length} 筆）
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            以下設定將統一套用至所有選取的 {requestIds.length} 筆申請單。
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                付款方式 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">請選擇</option>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">付款日期</label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">付款對象（統一套用）</label>
            <select
              value={recipientValue}
              onChange={(e) => setRecipientValue(e.target.value)}
              className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">請選擇（選填）</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
              <option value="OTHER">其他</option>
            </select>
            {recipientValue === "OTHER" && (
              <input
                type="text"
                value={customRecipient}
                onChange={(e) => setCustomRecipient(e.target.value)}
                placeholder="請輸入付款對象名稱"
                className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {paymentMethod === "BANK_TRANSFER" && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">匯款帳號後五碼</label>
              <input
                type="text"
                value={bankLastFive}
                onChange={(e) => setBankLastFive(e.target.value)}
                maxLength={5}
                pattern="\d{1,5}"
                placeholder="例：12345"
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>
          )}

          {financialAccounts.length > 0 && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">付款帳戶（選填，選擇後自動記錄出帳）</label>
              <select
                value={financialAccountId}
                onChange={(e) => setFinancialAccountId(e.target.value)}
                className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">不記錄帳戶（選填）</option>
                {financialAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">付款備註（統一套用）</label>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={2}
              placeholder="付款備註（選填）"
              className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={pending}>
              取消
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "處理中…" : `確認標記 ${requestIds.length} 筆已付款`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
