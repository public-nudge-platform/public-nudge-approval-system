"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createPaymentRecipient, updatePaymentRecipient, togglePaymentRecipientActive } from "@/lib/actions/paymentRecipient";
import { UserPlus, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Recipient = {
  id: string;
  name: string;
  bankName: string | null;
  bankCode: string | null;
  branchName: string | null;
  branchCode: string | null;
  bankAccountNumber: string | null;
  paymentInfoNote: string | null;
  isActive: boolean;
  createdAt: Date;
};

type RecipientFormState = {
  name: string;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  bankAccountNumber: string;
  paymentInfoNote: string;
};

function recipientToFormState(recipient?: Recipient): RecipientFormState {
  return {
    name: recipient?.name ?? "",
    bankName: recipient?.bankName ?? "",
    bankCode: recipient?.bankCode ?? "",
    branchName: recipient?.branchName ?? "",
    branchCode: recipient?.branchCode ?? "",
    bankAccountNumber: recipient?.bankAccountNumber ?? "",
    paymentInfoNote: recipient?.paymentInfoNote ?? "",
  };
}

function RecipientFields({
  form,
  setForm,
  autoFocus,
}: {
  form: RecipientFormState;
  setForm: React.Dispatch<React.SetStateAction<RecipientFormState>>;
  autoFocus?: boolean;
}) {
  const set = (key: keyof RecipientFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  return (
    <>
      <div>
        <label className="block text-xs text-gray-600 mb-1">名稱</label>
        <input
          value={form.name}
          onChange={set("name")}
          required
          placeholder="例：王小明"
          autoFocus={autoFocus}
          className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">銀行名稱</label>
          <input
            value={form.bankName}
            onChange={set("bankName")}
            placeholder="台灣銀行"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">銀行代碼</label>
          <input
            value={form.bankCode}
            onChange={set("bankCode")}
            placeholder="004"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">分行名稱</label>
          <input
            value={form.branchName}
            onChange={set("branchName")}
            placeholder="信義分行"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">分行代碼</label>
          <input
            value={form.branchCode}
            onChange={set("branchCode")}
            placeholder="0048"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">銀行帳號</label>
        <input
          value={form.bankAccountNumber}
          onChange={set("bankAccountNumber")}
          placeholder="請輸入完整帳號"
          className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">收款備註</label>
        <textarea
          value={form.paymentInfoNote}
          onChange={set("paymentInfoNote")}
          rows={2}
          placeholder="可放戶名或其他固定收款資訊"
          className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>
    </>
  );
}

function EditModal({ recipient, onClose, onSaved }: { recipient: Recipient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<RecipientFormState>(recipientToFormState(recipient));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePaymentRecipient(recipient.id, form);
      if (result?.error) { setError(result.error); return; }
      onSaved();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">編輯付款對象</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <RecipientFields form={form} setForm={setForm} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">取消</button>
            <Button type="submit" disabled={pending} size="sm">{pending ? "儲存中…" : "儲存"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<RecipientFormState>(recipientToFormState());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPaymentRecipient(form);
      if (result?.error) { setError(result.error); return; }
      onSaved();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">新增付款對象</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <RecipientFields form={form} setForm={setForm} autoFocus />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">取消</button>
            <Button type="submit" disabled={pending} size="sm">{pending ? "新增中…" : "新增"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RecipientsClient({ recipients: initial }: { recipients: Recipient[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Recipient | null>(null);
  const [pending, startTransition] = useTransition();
  const [recipients, setRecipients] = useState(initial);
  const router = useRouter();

  useEffect(() => {
    setRecipients(initial);
  }, [initial]);

  function refreshRecipients() {
    router.refresh();
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await togglePaymentRecipientActive(id, !current);
      setRecipients((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !current } : r));
    });
  }

  const active = recipients.filter((r) => r.isActive);
  const inactive = recipients.filter((r) => !r.isActive);

  return (
    <>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSaved={refreshRecipients} />}
      {editTarget && <EditModal recipient={editTarget} onClose={() => setEditTarget(null)} onSaved={refreshRecipients} />}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">共 {active.length} 筆啟用</p>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <UserPlus size={14} />
          新增付款對象
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600">名稱</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">銀行資訊</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">狀態</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">建立日期</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[...active, ...inactive].map((r) => (
              <tr key={r.id} className={`transition-colors ${r.isActive ? "hover:bg-gray-50" : "bg-gray-50/50 opacity-60"}`}>
                <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {r.bankName || r.bankCode || r.branchName || r.branchCode || r.bankAccountNumber || r.paymentInfoNote ? (
                    <div className="space-y-0.5">
                      {(r.bankName || r.bankCode) && <p>{[r.bankCode, r.bankName].filter(Boolean).join(" ")}</p>}
                      {(r.branchName || r.branchCode) && <p>{[r.branchCode, r.branchName].filter(Boolean).join(" ")}</p>}
                      {r.bankAccountNumber && <p className="font-mono">{r.bankAccountNumber}</p>}
                      {r.paymentInfoNote && <p className="text-gray-400 truncate max-w-[220px]" title={r.paymentInfoNote}>{r.paymentInfoNote}</p>}
                    </div>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.isActive
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-200"><CheckCircle2 size={11} />啟用</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><XCircle size={11} />停用</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.createdAt.toLocaleDateString("zh-TW")}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditTarget(r)}
                      className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
                    >
                      <Pencil size={12} />
                      編輯
                    </button>
                    <button
                      onClick={() => handleToggle(r.id, r.isActive)}
                      disabled={pending}
                      className={`text-xs flex items-center gap-1 ${r.isActive ? "text-orange-500 hover:text-orange-700" : "text-green-600 hover:text-green-800"}`}
                    >
                      {r.isActive ? <><XCircle size={12} />停用</> : <><CheckCircle2 size={12} />啟用</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {recipients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">尚無付款對象</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
