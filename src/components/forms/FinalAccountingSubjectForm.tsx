"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateFinalAccountingSubject } from "@/lib/actions/request";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

type Subject = { id: string; code: string; name: string; direction: string };

export function FinalAccountingSubjectForm({
  requestId,
  currentFinalSubjectId,
  accountingSubjects,
}: {
  requestId: string;
  currentFinalSubjectId: string | null;
  accountingSubjects: Subject[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentFinalSubjectId ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!selected) { setError("請選擇會計科目"); return; }
    if (selected === currentFinalSubjectId) { setError("未作任何變更"); return; }
    setError(null);
    startTransition(async () => {
      const result = await updateFinalAccountingSubject(requestId, selected);
      if (result?.error) { setError(result.error); toast.error(result.error); return; }
      setSaved(true);
      toast.success("正式會計科目已更新");
      router.refresh();
    });
  }

  if (saved) {
    return <p className="text-xs text-green-600 font-medium">正式會計科目已更新</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">修改正式會計科目（財務）</p>
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setSaved(false); }}
          className="flex-1 text-sm text-gray-800 border border-slate-300 rounded-lg px-3 py-1.5 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">請選擇</option>
          {accountingSubjects.map((s) => (
            <option key={s.id} value={s.id}>{s.code} {s.name}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <Check size={12} />
          {isPending ? "儲存…" : "確認"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
