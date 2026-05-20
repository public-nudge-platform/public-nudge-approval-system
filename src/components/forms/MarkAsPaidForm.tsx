"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { markAsPaid } from "@/lib/actions/request";
import { Button } from "@/components/ui/Button";
import { UploadZone } from "@/components/ui/UploadZone";
import { Banknote } from "lucide-react";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";

type Recipient = { id: string; name: string };
type AccountingSubject = { id: string; code: string; name: string; direction: string };

export function MarkAsPaidForm({
  requestId,
  defaultPaymentMethod,
  recipients = [],
  accountingSubjects = [],
  currentFinalSubjectId,
}: {
  requestId: string;
  defaultPaymentMethod?: string;
  recipients?: Recipient[];
  accountingSubjects?: AccountingSubject[];
  currentFinalSubjectId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(defaultPaymentMethod ?? "");
  const [recipientValue, setRecipientValue] = useState("");
  const [customRecipient, setCustomRecipient] = useState("");
  const [finalSubjectId, setFinalSubjectId] = useState(currentFinalSubjectId ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    const paymentRecipientName =
      recipientValue === "OTHER" ? customRecipient.trim() : recipientValue || undefined;

    startTransition(async () => {
      const result = await markAsPaid(requestId, {
        paymentMethod: data.get("paymentMethod") as string,
        paymentNote: (data.get("paymentNote") as string) || undefined,
        paidAt: (data.get("paidAt") as string) || undefined,
        bankLastFive: (data.get("bankLastFive") as string) || undefined,
        paymentRecipientName,
        finalAccountingSubjectId: finalSubjectId || undefined,
      });
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
        <p className="text-green-600 font-medium text-sm">付款已記錄完成</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Banknote size={15} className="text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-800">標記付款</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">付款方式 <span className="text-red-500">*</span></label>
          <select
            name="paymentMethod"
            required
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
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
            name="paidAt"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">付款對象</label>
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

      {selectedMethod === "BANK_TRANSFER" && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">匯款帳號後五碼</label>
          <input
            type="text"
            name="bankLastFive"
            maxLength={5}
            pattern="\d{1,5}"
            placeholder="例：12345"
            className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
        </div>
      )}

      {accountingSubjects.length > 0 && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">正式會計科目（選填）</label>
          <select
            value={finalSubjectId}
            onChange={(e) => setFinalSubjectId(e.target.value)}
            className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">請選擇（如需修正）</option>
            {accountingSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code} {s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">付款備註</label>
        <textarea
          name="paymentNote"
          rows={2}
          placeholder="付款備註（選填）"
          className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">付款證明附件（選填）</label>
        <UploadZone requestId={requestId} isPayment />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "處理中…" : "確認付款完成"}
      </Button>
    </form>
  );
}
