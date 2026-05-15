"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UploadZone } from "@/components/ui/UploadZone";
import { createRequest } from "@/lib/actions/request";
import type { RequestType } from "@prisma/client";
import { useRouter } from "next/navigation";

type ActiveProject = { id: string; name: string };

type Item = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  note: string;
};

function newItem(): Item {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, note: "" };
}

function formatNumber(n: number) {
  return n.toLocaleString("zh-TW");
}

export function NewRequestForm({ projects = [] }: { projects?: ActiveProject[] }) {
  const [type, setType] = useState<RequestType>("REIMBURSEMENT");
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [paymentInfoNote, setPaymentInfoNote] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  function updateItem(id: string, field: keyof Item, value: string | number) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSubmit(submit: boolean) {
    setError(null);

    if (!title.trim()) { setError("請填寫標題"); return; }
    if (!projectId) { setError("請選擇專案"); return; }
    if (items.some((i) => !i.description.trim())) { setError("請填寫所有品項說明"); return; }
    if (items.some((i) => i.quantity <= 0 || i.unitPrice <= 0)) { setError("品項數量與單價必須大於 0"); return; }

    startTransition(async () => {
      const result = await createRequest({
        type,
        title: title.trim(),
        projectId: projectId || undefined,
        purpose: purpose.trim() || undefined,
        neededBy: neededBy || undefined,
        paymentMethod: paymentMethod || undefined,
        recipientName: recipientName.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankCode: bankCode.trim() || undefined,
        branchName: branchName.trim() || undefined,
        branchCode: branchCode.trim() || undefined,
        paymentInfoNote: paymentInfoNote.trim() || undefined,
        items: items.map((i) => ({
          description: i.description.trim(),
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          note: i.note.trim() || undefined,
        })),
        submit,
      });

      if (!result || "error" in result) { setError(("error" in result ? result.error : null) ?? "建立失敗"); return; }

      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("requestId", result.id);
        await fetch("/api/upload", { method: "POST", body: fd });
      }

      router.push(`/requests/${result.id}`);
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
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}
            >
              {t === "REIMBURSEMENT" ? "一般請款" : "預付請款"}
              <p className={`text-xs mt-0.5 font-normal ${type === t ? "text-blue-500" : "text-gray-400"}`}>
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
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：2026 年度會員大會餐費"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              專案 <span className="text-red-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">請選擇專案</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {type === "PREPAID" ? "預計需款日期" : "需款期限"}
            </label>
            <input
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">支出用途說明</label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            placeholder="簡述費用用途…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">費用明細</h2>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 px-1 mb-1">
            <span className="col-span-5 text-xs font-medium text-gray-400">品項說明</span>
            <span className="col-span-2 text-xs font-medium text-gray-400 text-center">數量</span>
            <span className="col-span-2 text-xs font-medium text-gray-400 text-right">單價</span>
            <span className="col-span-2 text-xs font-medium text-gray-400 text-right">小計</span>
            <span className="col-span-1" />
          </div>

          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={item.description}
                onChange={(e) => updateItem(item.id, "description", e.target.value)}
                placeholder="品項說明"
                className="col-span-5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                className="col-span-2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={item.unitPrice}
                onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                className="col-span-2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
              <div className="col-span-2 text-right">
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  {formatNumber(item.quantity * item.unitPrice)}
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
            </div>
          ))}
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
            <p className="text-xs text-gray-400">申請總金額</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {formatNumber(total)} <span className="text-sm font-normal text-gray-400">元</span>
            </p>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">收款資訊（選填）</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">希望付款方式</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="王小明"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">銀行名稱</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="台灣銀行"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">銀行代碼</label>
            <input
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              placeholder="004"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">分行代碼</label>
            <input
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              placeholder="0048"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">備註</label>
          <textarea
            value={paymentInfoNote}
            onChange={(e) => setPaymentInfoNote(e.target.value)}
            rows={2}
            placeholder="可補充說明，或描述附上的付款資訊影本內容"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Attachments */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">附件上傳</h2>
        <UploadZone onFilesChange={setPendingFiles} />
        <p className="text-xs text-gray-400 mt-2">* 請附上發票、收據或相關憑證</p>
      </div>

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
          儲存草稿
        </Button>
        <Button
          variant="primary"
          onClick={() => handleSubmit(true)}
          loading={isPending}
          disabled={isPending}
        >
          送出申請
        </Button>
        <span className="text-xs text-gray-400">送出後將通知理事長審核</span>
      </div>
    </div>
  );
}
