"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransaction } from "@/lib/actions/financialAccount";
import { Button } from "@/components/ui/Button";
import { PlusCircle, X } from "lucide-react";

type Project = { id: string; name: string };
type AccountingSubject = { id: string; code: string; name: string };

type Props = {
  accountId: string;
  canWrite: boolean;
  projects: Project[];
  accountingSubjects: AccountingSubject[];
};

export function AddTransactionButton({ accountId, canWrite, projects, accountingSubjects }: Props) {
  const [open, setOpen] = useState(false);
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!canWrite) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createTransaction({
        accountId,
        type: txType,
        amount: parseFloat(fd.get("amount") as string),
        transactionDate: fd.get("transactionDate") as string,
        summary: fd.get("summary") as string,
        counterparty: (fd.get("counterparty") as string) || undefined,
        projectId: (fd.get("projectId") as string) || undefined,
        accountingSubjectId: (fd.get("accountingSubjectId") as string) || undefined,
        note: (fd.get("note") as string) || undefined,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => { setTxType("INCOME"); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <PlusCircle size={13} /> 新增入帳
        </button>
        <button
          onClick={() => { setTxType("EXPENSE"); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          <PlusCircle size={13} /> 新增出帳
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {txType === "INCOME" ? "新增入帳" : "新增出帳"}
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">日期 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    name="transactionDate"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">金額 <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="amount"
                    required
                    min="1"
                    step="1"
                    placeholder="0"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">摘要 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="summary"
                  required
                  placeholder={txType === "INCOME" ? "例：政府補助款" : "例：講師費"}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  {txType === "INCOME" ? "收入來源／交易對象" : "交易對象"}（選填）
                </label>
                <input
                  type="text"
                  name="counterparty"
                  placeholder={txType === "INCOME" ? "例：文化部" : "例：某廠商"}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">對應專案（選填）</label>
                <select
                  name="projectId"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">不指定</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {accountingSubjects.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">會計科目（選填）</label>
                  <select
                    name="accountingSubjectId"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">不指定</option>
                    {accountingSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} {s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-600 mb-1">備註（選填）</label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? "處理中…" : "確認新增"}
                </Button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
