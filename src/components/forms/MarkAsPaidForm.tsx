"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { markAsPaid } from "@/lib/actions/request";
import { Button } from "@/components/ui/Button";
import { Banknote } from "lucide-react";

const PAYMENT_METHODS = [
  "銀行轉帳",
  "現金",
  "支票",
  "信用卡",
  "其他",
];

export function MarkAsPaidForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await markAsPaid(requestId, {
        paymentMethod: data.get("paymentMethod") as string,
        paymentReference: (data.get("paymentReference") as string) || undefined,
        paymentNote: (data.get("paymentNote") as string) || undefined,
        paidAt: (data.get("paidAt") as string) || undefined,
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

      <div>
        <label className="block text-xs text-gray-500 mb-1">付款方式 <span className="text-red-500">*</span></label>
        <select
          name="paymentMethod"
          required
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">請選擇</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">付款日期</label>
        <input
          type="date"
          name="paidAt"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">付款憑證編號</label>
        <input
          type="text"
          name="paymentReference"
          placeholder="如：轉帳末五碼、支票號碼"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">備註</label>
        <textarea
          name="paymentNote"
          rows={2}
          placeholder="付款備註（選填）"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "處理中…" : "確認付款完成"}
      </Button>
    </form>
  );
}
