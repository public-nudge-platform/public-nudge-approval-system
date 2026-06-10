"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { PlusCircle, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UploadZone } from "@/components/ui/UploadZone";
import { createRequest, updateRequest } from "@/lib/actions/request";
import { saveRecipientFromForm } from "@/lib/actions/paymentRecipient";
import { BookmarkPlus, Check } from "lucide-react";
import type { RequestType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

type ActiveProject = { id: string; name: string };
type ActiveRecipient = {
  id: string;
  name: string;
  bankName: string | null;
  bankCode: string | null;
  branchName: string | null;
  branchCode: string | null;
  bankAccountNumber: string | null;
  paymentInfoNote: string | null;
};
type ActiveAccountingSubject = { id: string; code: string; name: string; direction: string };

type Item = {
  id: string;
  description: string;
  quantity: number | "";
  unitPrice: number | "";
  note: string;
  voucherDate: string;
};

type InitialRequest = {
  id: string;
  type: RequestType;
  title: string;
  projectId: string | null;
  purpose: string | null;
  neededBy: Date | null;
  paymentMethod: string | null;
  recipientName: string | null;
  bankName: string | null;
  bankCode: string | null;
  branchName: string | null;
  branchCode: string | null;
  bankAccountNumber: string | null;
  paymentInfoNote: string | null;
  accountingSubjectId: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number | { toString(): string };
    note: string | null;
    voucherDate: string | null;
  }[];
};

function newItem(): Item {
  return { id: crypto.randomUUID(), description: "", quantity: "", unitPrice: "", note: "", voucherDate: "" };
}

function formatNumber(n: number) {
  return n.toLocaleString("zh-TW");
}

type ItemFieldErrors = { description?: boolean; quantity?: boolean; unitPrice?: boolean };
type FieldErrors = {
  title?: boolean;
  projectId?: boolean;
  items?: Record<string, ItemFieldErrors>;
};

const INPUT_BASE = "w-full px-3 py-2 text-sm text-gray-800 border rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const INPUT_ERROR = "border-red-300 focus:ring-red-500 focus:border-red-500";
const INPUT_NORMAL = "border-slate-300";

function inputClass(hasError?: boolean, extra?: string) {
  return clsx(INPUT_BASE, hasError ? INPUT_ERROR : INPUT_NORMAL, extra);
}

export function NewRequestForm({ projects = [], recipients = [], accountingSubjects = [], initialRequest, returnTo }: { projects?: ActiveProject[]; recipients?: ActiveRecipient[]; accountingSubjects?: ActiveAccountingSubject[]; initialRequest?: InitialRequest; returnTo?: string }) {
  const isEdit = !!initialRequest;
  const [type, setType] = useState<RequestType>(initialRequest?.type ?? "REIMBURSEMENT");
  const [title, setTitle] = useState(initialRequest?.title ?? "");
  const [projectId, setProjectId] = useState(initialRequest?.projectId ?? "");
  const [purpose, setPurpose] = useState(initialRequest?.purpose ?? "");
  const [paymentMethod, setPaymentMethod] = useState(initialRequest?.paymentMethod ?? "");
  const [recipientName, setRecipientName] = useState(initialRequest?.recipientName ?? "");
  const [bankName, setBankName] = useState(initialRequest?.bankName ?? "");
  const [bankCode, setBankCode] = useState(initialRequest?.bankCode ?? "");
  const [branchName, setBranchName] = useState(initialRequest?.branchName ?? "");
  const [branchCode, setBranchCode] = useState(initialRequest?.branchCode ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(initialRequest?.bankAccountNumber ?? "");
  const [paymentInfoNote, setPaymentInfoNote] = useState(initialRequest?.paymentInfoNote ?? "");
  const [accountingSubjectId, setAccountingSubjectId] = useState(initialRequest?.accountingSubjectId ?? "");
  const [items, setItems] = useState<Item[]>(
    initialRequest?.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      note: item.note ?? "",
      voucherDate: item.voucherDate ?? "",
    })) ?? [newItem()]
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const [bankSelectorName, setBankSelectorName] = useState<string | null>(null); // name of recipient with multiple banks
  const [savedRecipient, setSavedRecipient] = useState(false); // success flash
  const [savingRecipient, setSavingRecipient] = useState(false);
  const router = useRouter();

  // Group recipients by name
  const recipientGroups = recipients.reduce<Record<string, ActiveRecipient[]>>((acc, r) => {
    if (!acc[r.name]) acc[r.name] = [];
    acc[r.name].push(r);
    return acc;
  }, {});
  const recipientNames = Object.keys(recipientGroups);

  const hasPaymentInfo = !!(
    paymentMethod || recipientName || bankName || bankCode ||
    branchName || branchCode || bankAccountNumber || paymentInfoNote
  );

  const total = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  function updateItem(id: string, field: keyof Item, value: string | number) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function applyRecipient(recipient: ActiveRecipient) {
    setRecipientName(recipient.name);
    setBankName(recipient.bankName ?? "");
    setBankCode(recipient.bankCode ?? "");
    setBranchName(recipient.branchName ?? "");
    setBranchCode(recipient.branchCode ?? "");
    setBankAccountNumber(recipient.bankAccountNumber ?? "");
    setPaymentInfoNote(recipient.paymentInfoNote ?? "");
    setBankSelectorName(null);
  }

  function handleChipClick(name: string) {
    const group = recipientGroups[name] ?? [];
    if (group.length === 1) {
      applyRecipient(group[0]);
    } else {
      setBankSelectorName((prev) => prev === name ? null : name);
      setRecipientName(name);
    }
  }

  async function saveAsRecipient() {
    if (!recipientName.trim()) return;
    setSavingRecipient(true);
    const result = await saveRecipientFromForm({
      name: recipientName,
      bankName: bankName || undefined,
      bankCode: bankCode || undefined,
      branchName: branchName || undefined,
      branchCode: branchCode || undefined,
      bankAccountNumber: bankAccountNumber || undefined,
      paymentInfoNote: paymentInfoNote || undefined,
    });
    setSavingRecipient(false);
    if (!result?.error) {
      setSavedRecipient(true);
      toast.success("已加入常用收款人");
      setTimeout(() => setSavedRecipient(false), 2500);
    } else {
      toast.error(result.error);
    }
  }

  function handleSubmit(submit: boolean) {
    setError(null);

    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = true;
    if (!projectId) errors.projectId = true;

    const itemErrors: Record<string, ItemFieldErrors> = {};
    for (const i of items) {
      const e: ItemFieldErrors = {};
      if (!i.description.trim()) e.description = true;
      if (!i.quantity || i.quantity <= 0) e.quantity = true;
      if (i.unitPrice === "" || i.unitPrice < 0) e.unitPrice = true;
      if (Object.keys(e).length > 0) itemErrors[i.id] = e;
    }
    if (Object.keys(itemErrors).length > 0) errors.items = itemErrors;

    setFieldErrors(errors);

    if (errors.title) { setError("請填寫申請標題"); return; }
    if (errors.projectId) { setError("請選擇專案"); return; }
    if (errors.items) {
      const hasDescriptionError = Object.values(errors.items).some((e) => e.description);
      setError(hasDescriptionError ? "請填寫所有品項說明" : "請填寫所有品項的數量與單價");
      return;
    }

    startTransition(async () => {
      const payload = {
        type,
        title: title.trim(),
        projectId: projectId || undefined,
        purpose: purpose.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        recipientName: recipientName.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankCode: bankCode.trim() || undefined,
        branchName: branchName.trim() || undefined,
        branchCode: branchCode.trim() || undefined,
        bankAccountNumber: bankAccountNumber.trim() || undefined,
        paymentInfoNote: paymentInfoNote.trim() || undefined,
        accountingSubjectId: accountingSubjectId || undefined,
        items: items.map((i) => ({
          description: i.description.trim(),
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          note: i.note.trim() || undefined,
          voucherDate: i.voucherDate || undefined,
        })),
        submit,
      };

      const result = isEdit
        ? await updateRequest(initialRequest!.id, payload)
        : await createRequest(payload);

      if (!result || "error" in result) {
        const message = ("error" in result ? result.error : null) ?? "建立失敗";
        setError(message);
        toast.error(message);
        return;
      }

      setFieldErrors({});

      await Promise.all(pendingFiles.map((file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("requestId", result.id);
        return fetch("/api/upload", { method: "POST", body: fd });
      }));

      toast.success(submit ? "申請單已送出" : "草稿已儲存");
      router.push(isEdit && returnTo ? returnTo : `/requests/${result.id}`);
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Type selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">申請類型</h2>
        <div className="flex gap-3">
          {(["REIMBURSEMENT", "PREPAID"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                type === t
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-gray-600 hover:border-slate-400"
              }`}
            >
              {t === "REIMBURSEMENT" ? "一般請款" : "預付請款"}
              <p className={`text-xs mt-0.5 font-normal ${type === t ? "text-blue-500" : "text-gray-500"}`}>
                {t === "REIMBURSEMENT" ? "事後報銷已支付費用" : "事前申請預付款項"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">基本資料</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            申請標題 <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: false }));
            }}
            placeholder="例：2026 年度會員大會餐費"
            className={inputClass(fieldErrors.title)}
          />
          {fieldErrors.title && <p className="text-xs text-red-600 mt-1">請填寫申請標題</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              專案 <span className="text-red-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                if (fieldErrors.projectId) setFieldErrors((prev) => ({ ...prev, projectId: false }));
              }}
              className={inputClass(fieldErrors.projectId, "bg-white")}
            >
              <option value="">請選擇專案</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {fieldErrors.projectId && <p className="text-xs text-red-600 mt-1">請選擇專案</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            申請會計科目
          </label>
          <select
            value={accountingSubjectId}
            onChange={(e) => setAccountingSubjectId(e.target.value)}
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">請選擇會計科目（選填）</option>
            {accountingSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code} {s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">支出用途說明</label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            placeholder="簡述費用用途…"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">費用明細</h2>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 px-1 mb-1">
            <span className="col-span-5 text-xs font-medium text-gray-500">品項說明</span>
            <span className="col-span-2 text-xs font-medium text-gray-500 text-center">數量</span>
            <span className="col-span-2 text-xs font-medium text-gray-500 text-right">單價</span>
            <span className="col-span-2 text-xs font-medium text-gray-500 text-right">小計</span>
            <span className="col-span-1" />
          </div>

          {items.map((item) => {
            const itemError = fieldErrors.items?.[item.id];
            const itemInputClass = (hasError?: boolean, extra?: string) => clsx(
              "px-2.5 py-1.5 text-sm text-gray-800 border rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              hasError ? INPUT_ERROR : INPUT_NORMAL,
              extra
            );

            function clearItemError(field: keyof ItemFieldErrors) {
              if (!fieldErrors.items?.[item.id]?.[field]) return;
              setFieldErrors((prev) => {
                if (!prev.items?.[item.id]) return prev;
                const { [field]: _removed, ...rest } = prev.items[item.id];
                const items = { ...prev.items, [item.id]: rest };
                if (Object.keys(rest).length === 0) delete items[item.id];
                return { ...prev, items };
              });
            }

            return (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
              <input
                value={item.description}
                onChange={(e) => { updateItem(item.id, "description", e.target.value); clearItemError("description"); }}
                placeholder="品項說明"
                className={itemInputClass(itemError?.description, "col-span-5")}
              />
              <input
                type="number"
                min="1"
                value={item.quantity}
                placeholder="數量"
                onChange={(e) => { updateItem(item.id, "quantity", e.target.value === "" ? "" : Number(e.target.value)); clearItemError("quantity"); }}
                className={itemInputClass(itemError?.quantity, "col-span-2 text-center")}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={item.unitPrice}
                placeholder="單價"
                onChange={(e) => { updateItem(item.id, "unitPrice", e.target.value === "" ? "" : Number(e.target.value)); clearItemError("unitPrice"); }}
                className={itemInputClass(itemError?.unitPrice, "col-span-2 text-right")}
              />
              <div className="col-span-2 text-right py-1.5">
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  {formatNumber((item.quantity || 0) * (item.unitPrice || 0))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className="col-span-1 flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-0 transition-colors"
              >
                <Trash2 size={14} />
              </button>

              <div className="col-span-12 flex items-center gap-2 pl-1">
                <span className="text-xs text-gray-400 whitespace-nowrap">憑證日期（發票/收據日期）</span>
                <DatePicker
                  value={item.voucherDate}
                  onChange={(v) => updateItem(item.id, "voucherDate", v)}
                  placeholder="選擇日期"
                />
              </div>
            </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem()])}
          className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          <PlusCircle size={14} />
          新增品項
        </button>

        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <div className="text-right">
            <p className="text-xs text-gray-500">申請總金額</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {formatNumber(total)} <span className="text-sm font-normal text-gray-500">元</span>
            </p>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <CollapsibleSection
        title="收款資訊（選填）"
        subtitle="希望付款方式、收款人與銀行帳戶資訊"
        defaultOpen={hasPaymentInfo}
      >
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">希望付款方式</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">請選擇（選填）</option>
            <option value="銀行轉帳">銀行轉帳</option>
            <option value="現金">現金</option>
            <option value="支票">支票</option>
            <option value="信用卡">信用卡</option>
            <option value="其他">其他</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">收款人姓名</label>
          {recipientNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {recipientNames.map((name) => {
                const group = recipientGroups[name];
                const isActive = recipientName === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleChipClick(name)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {name}
                    {group.length > 1 && (
                      <span className={`ml-1 ${isActive ? "text-blue-200" : "text-gray-400"}`}>
                        · {group.length} 組帳戶
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Bank selector for recipients with multiple accounts */}
          {bankSelectorName && (recipientGroups[bankSelectorName]?.length ?? 0) > 1 && (
            <div className="mb-2 border border-blue-100 rounded-lg bg-blue-50 p-3 space-y-1.5">
              <p className="text-xs font-medium text-blue-700 mb-2">選擇銀行帳戶</p>
              {recipientGroups[bankSelectorName].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => applyRecipient(r)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <span className="font-medium text-gray-800">
                    {[r.bankCode, r.bankName].filter(Boolean).join(" ")}
                  </span>
                  {(r.branchName || r.branchCode) && (
                    <span className="text-gray-500 ml-1.5">
                      {[r.branchCode, r.branchName].filter(Boolean).join(" ")}
                    </span>
                  )}
                  {r.bankAccountNumber && (
                    <span className="ml-1.5 font-mono text-gray-500">{r.bankAccountNumber}</span>
                  )}
                  {!r.bankName && !r.bankCode && !r.bankAccountNumber && (
                    <span className="text-gray-400">（無銀行資訊）</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <input
            value={recipientName}
            onChange={(e) => { setRecipientName(e.target.value); setBankSelectorName(null); }}
            placeholder="王小明（可手動輸入）"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">銀行名稱</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="台灣銀行"
              className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">銀行代碼</label>
            <input
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              placeholder="004"
              className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">分行名稱</label>
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="信義分行"
              className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">分行代碼</label>
            <input
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              placeholder="0048"
              className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">銀行帳號</label>
          <input
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            placeholder="請輸入完整帳號"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">備註</label>
          <textarea
            value={paymentInfoNote}
            onChange={(e) => setPaymentInfoNote(e.target.value)}
            rows={2}
            placeholder="可補充說明，或描述附上的付款資訊影本內容"
            className="w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {recipientName.trim() && (bankName || bankAccountNumber) && (
          <button
            type="button"
            onClick={saveAsRecipient}
            disabled={savingRecipient || savedRecipient}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 transition-colors"
          >
            {savedRecipient ? (
              <><Check size={12} />已加入常用收款人</>
            ) : savingRecipient ? (
              "儲存中…"
            ) : (
              <><BookmarkPlus size={12} />加入常用收款人</>
            )}
          </button>
        )}
      </CollapsibleSection>

      {/* Attachments */}
      <CollapsibleSection
        title="附件上傳"
        subtitle="選填，建議附上發票、收據或相關憑證"
        defaultOpen={isEdit}
      >
        <UploadZone onFilesChange={setPendingFiles} />
        <p className="text-xs text-gray-500 mt-2">* 請附上發票、收據或相關憑證</p>
      </CollapsibleSection>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pb-8">
        <Button
          variant="secondary"
          onClick={() => handleSubmit(false)}
          loading={isPending}
          disabled={isPending}
        >
          {isEdit ? "儲存變更" : "儲存草稿"}
        </Button>
        <Button
          variant="primary"
          onClick={() => handleSubmit(true)}
          loading={isPending}
          disabled={isPending}
        >
          {isEdit ? "重新送出" : "送出申請"}
        </Button>
        <span className="text-xs text-gray-500">送出後將通知理事長審核</span>
      </div>
    </div>
  );
}
