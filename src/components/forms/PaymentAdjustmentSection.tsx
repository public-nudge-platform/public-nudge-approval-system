"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronsUpDown, ChevronUp } from "lucide-react";
import {
  createPaymentAdjustment,
  updatePaymentAdjustment,
  deletePaymentAdjustment,
} from "@/lib/actions/paymentAdjustment";
import { PAYMENT_ADJUSTMENT_TYPE_LABEL, PAYMENT_ADJUSTMENT_TYPE_OPTIONS } from "@/lib/constants";
import type { PaymentAdjustmentType } from "@prisma/client";

type AccountingSubject = { id: string; code: string; name: string };

type Adjustment = {
  id: string;
  type: PaymentAdjustmentType;
  amount: number;
  occurredAt: Date;
  note: string | null;
  accountingSubjectId: string | null;
  accountingSubject: AccountingSubject | null;
  createdBy: { name: string };
  createdAt: Date;
};

type Props = {
  requestId: string;
  adjustments: Adjustment[];
  canWrite: boolean;
  accountingSubjects: AccountingSubject[];
};

type FormState = {
  type: PaymentAdjustmentType;
  amount: string;
  accountingSubjectId: string;
  occurredAt: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  type: "BANK_FEE",
  amount: "",
  accountingSubjectId: "",
  occurredAt: today(),
  note: "",
});

function AdjustmentForm({
  initial,
  onSave,
  onCancel,
  accountingSubjects,
  pending,
  error,
}: {
  initial: FormState;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  accountingSubjects: AccountingSubject[];
  pending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">調整類型 <span className="text-red-500">*</span></label>
          <select
            value={form.type}
            onChange={set("type")}
            className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {PAYMENT_ADJUSTMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">金額（元）<span className="text-red-500">*</span></label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.amount}
            onChange={set("amount")}
            placeholder="例：30"
            className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">發生日期 <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={form.occurredAt}
            onChange={set("occurredAt")}
            className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">會計科目（選填）</label>
          <select
            value={form.accountingSubjectId}
            onChange={set("accountingSubjectId")}
            className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">請選擇（選填）</option>
            {accountingSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code} {s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">備註（選填）</label>
        <textarea
          value={form.note}
          onChange={set("note")}
          rows={2}
          placeholder="說明此費用的來源或用途"
          className="w-full text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-2 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={pending}
          className="flex-1 text-sm font-medium bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "儲存中…" : "儲存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-sm text-gray-600 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export function PaymentAdjustmentSection({ requestId, adjustments, canWrite, accountingSubjects }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalAdjustment = adjustments.reduce((s, a) => s + a.amount, 0);

  function handleAdd(form: FormState) {
    setError(null);
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError("金額必須大於 0"); return; }
    startTransition(async () => {
      const res = await createPaymentAdjustment(requestId, {
        type: form.type as PaymentAdjustmentType,
        amount,
        accountingSubjectId: form.accountingSubjectId || undefined,
        occurredAt: form.occurredAt,
        note: form.note || undefined,
      });
      if (res?.error) { setError(res.error); }
      else { setShowAdd(false); router.refresh(); }
    });
  }

  function handleEdit(id: string, form: FormState) {
    setError(null);
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError("金額必須大於 0"); return; }
    startTransition(async () => {
      const res = await updatePaymentAdjustment(id, {
        type: form.type as PaymentAdjustmentType,
        amount,
        accountingSubjectId: form.accountingSubjectId || undefined,
        occurredAt: form.occurredAt,
        note: form.note || undefined,
      });
      if (res?.error) { setError(res.error); }
      else { setEditingId(null); router.refresh(); }
    });
  }

  function handleDelete(id: string) {
    setError(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deletePaymentAdjustment(id);
      if (res?.error) { setError(res.error); }
      setDeletingId(null);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChevronsUpDown size={14} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-700">付款調整紀錄</h2>
          {adjustments.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {adjustments.length}
            </span>
          )}
        </div>
        {canWrite && !showAdd && (
          <button
            type="button"
            onClick={() => { setShowAdd(true); setError(null); }}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
          >
            <Plus size={12} />
            新增付款調整
          </button>
        )}
      </div>

      {adjustments.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 text-center py-4">尚無付款調整紀錄</p>
      )}

      {adjustments.length > 0 && (
        <div className="space-y-2 mb-3">
          {adjustments.map((adj) =>
            editingId === adj.id ? (
              <div key={adj.id}>
                <AdjustmentForm
                  initial={{
                    type: adj.type,
                    amount: String(adj.amount),
                    accountingSubjectId: adj.accountingSubjectId ?? "",
                    occurredAt: adj.occurredAt instanceof Date
                      ? adj.occurredAt.toISOString().slice(0, 10)
                      : new Date(adj.occurredAt).toISOString().slice(0, 10),
                    note: adj.note ?? "",
                  }}
                  onSave={(form) => handleEdit(adj.id, form)}
                  onCancel={() => { setEditingId(null); setError(null); }}
                  accountingSubjects={accountingSubjects}
                  pending={pending}
                  error={error}
                />
              </div>
            ) : (
              <div
                key={adj.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {PAYMENT_ADJUSTMENT_TYPE_LABEL[adj.type]}
                    </span>
                    <span className="font-semibold text-blue-700 tabular-nums">
                      {adj.amount.toLocaleString()} 元
                    </span>
                  </div>
                  {adj.accountingSubject && (
                    <p className="text-xs text-gray-500 font-mono">
                      {adj.accountingSubject.code} {adj.accountingSubject.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    發生日期：{adj.occurredAt instanceof Date
                      ? adj.occurredAt.toLocaleDateString("zh-TW")
                      : new Date(adj.occurredAt).toLocaleDateString("zh-TW")}
                  </p>
                  {adj.note && <p className="text-xs text-gray-600">{adj.note}</p>}
                  <p className="text-xs text-gray-400">
                    由 {adj.createdBy.name} 於{" "}
                    {adj.createdAt instanceof Date
                      ? adj.createdAt.toLocaleDateString("zh-TW")
                      : new Date(adj.createdAt).toLocaleDateString("zh-TW")}{" "}
                    建立
                  </p>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { setEditingId(adj.id); setShowAdd(false); setError(null); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="編輯"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(adj.id)}
                      disabled={deletingId === adj.id || pending}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                      title="刪除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {showAdd && (
        <AdjustmentForm
          initial={emptyForm()}
          onSave={handleAdd}
          onCancel={() => { setShowAdd(false); setError(null); }}
          accountingSubjects={accountingSubjects}
          pending={pending}
          error={error}
        />
      )}

      {adjustments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-sm">
          <span className="text-xs text-gray-500">付款調整總額</span>
          <span className="font-semibold text-blue-700 tabular-nums">
            + {totalAdjustment.toLocaleString()} 元
          </span>
        </div>
      )}
    </div>
  );
}
