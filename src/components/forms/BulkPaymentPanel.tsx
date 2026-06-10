"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { clsx } from "clsx";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BulkMarkPaidModal } from "@/components/forms/BulkMarkPaidModal";
import type { RequestStatus, RequestType } from "@prisma/client";

type Item = {
  id: string;
  requestNumber: string | null;
  type: RequestType;
  title: string;
  submitterName: string;
  amount: number;
  status: RequestStatus;
  neededBy: string | null;
};

type Recipient = { id: string; name: string };
type FinancialAccount = { id: string; name: string };

export function BulkPaymentPanel({
  items,
  canBulkMarkPaid,
  recipients = [],
  financialAccounts = [],
}: {
  items: Item[];
  canBulkMarkPaid: boolean;
  recipients?: Recipient[];
  financialAccounts?: FinancialAccount[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function handleDone() {
    setModalOpen(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {canBulkMarkPaid && items.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            全選
          </label>
          <span className="text-xs text-gray-500">
            已選擇 {selected.size} / {items.length} 筆
          </span>
          <div className="flex-1" />
          <Button
            variant="primary"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => setModalOpen(true)}
          >
            <Banknote size={13} />
            批次標記已付款（{selected.size}）
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((req) => (
          <div
            key={req.id}
            className={clsx(
              "flex items-stretch gap-2 bg-white rounded-xl border border-gray-200 transition-all hover:border-gray-300 hover:shadow-sm",
              selected.has(req.id) && "ring-2 ring-blue-400 border-blue-400"
            )}
          >
            {canBulkMarkPaid && (
              <div className="flex items-center pl-4">
                <input
                  type="checkbox"
                  checked={selected.has(req.id)}
                  onChange={() => toggle(req.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            )}
            <Link
              href={`/requests/${req.id}?from=/finance`}
              className={clsx(
                "flex flex-1 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4",
                !canBulkMarkPaid && "pl-5"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <TypeBadge type={req.type} />
                  {req.requestNumber && (
                    <span className="font-mono text-xs text-gray-500">{req.requestNumber}</span>
                  )}
                </div>
                <p className="font-semibold text-gray-900 mt-1">{req.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{req.submitterName}</p>
                {req.neededBy && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    需款期限：{new Date(req.neededBy).toLocaleDateString("zh-TW")}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between flex-shrink-0 sm:flex-col sm:items-end sm:text-right">
                <p className="text-lg font-bold text-gray-900 tabular-nums">
                  {req.amount.toLocaleString()} 元
                </p>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={req.status} />
                  <p className="text-xs text-gray-500">點擊進入詳情頁付款</p>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {modalOpen && (
        <BulkMarkPaidModal
          requestIds={Array.from(selected)}
          recipients={recipients}
          financialAccounts={financialAccounts}
          onClose={() => setModalOpen(false)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
