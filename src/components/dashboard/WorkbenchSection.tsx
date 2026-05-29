"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_COLOR,
  REQUEST_TYPE_LABEL,
  REQUEST_TYPE_COLOR,
} from "@/lib/constants";
import type { RequestStatus, RequestType } from "@prisma/client";

export type WorkbenchRequest = {
  id: string;
  requestNumber: string | null;
  title: string;
  type: RequestType;
  status: RequestStatus;
  amount: number;
  updatedAt: string;
  submitterName: string;
  projectName: string | null;
};

export type WorkbenchCardConfig = {
  id: string;
  title: string;
  count: number;
  description: string;
  color: "amber" | "blue" | "green" | "purple" | "slate" | "red" | "indigo";
  href: string;
  items: WorkbenchRequest[];
  cardType: "task" | "tracking";
};

const NEXT_STEP: Record<RequestStatus, string> = {
  DRAFT:              "申請人需送出",
  PENDING:            "等待理事長/創會理事長簽核",
  RETURNED:           "申請人需修改重送",
  APPROVED:           "等待行政出納付款",
  PAID:               "申請人需送出沖銷",
  PENDING_SETTLEMENT: "申請人需送出沖銷",
  OFFSET_SUBMITTED:   "等待確認沖銷",
  OFFSET_RETURNED:    "申請人需補件重送",
  CLOSED:             "已結案",
  REJECTED:           "已拒絕",
  WITHDRAWN:          "已抽回",
};

const colorMap = {
  amber:  { dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  blue:   { dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  green:  { dot: "bg-green-400",  badge: "bg-green-50 text-green-700 border-green-200" },
  purple: { dot: "bg-purple-400", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  slate:  { dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-700 border-slate-200" },
  red:    { dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200" },
  indigo: { dot: "bg-indigo-400", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

function RequestRow({ req, cardType }: { req: WorkbenchRequest; cardType: "task" | "tracking" }) {
  const daysStuck = Math.floor((Date.now() - new Date(req.updatedAt).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-4 px-4 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-mono shrink-0">{req.requestNumber ?? "—"}</span>
          <span className="text-sm font-medium text-gray-900 truncate">{req.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${REQUEST_TYPE_COLOR[req.type]}`}>
            {REQUEST_TYPE_LABEL[req.type]}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${REQUEST_STATUS_COLOR[req.status]}`}>
            {REQUEST_STATUS_LABEL[req.status]}
          </span>
          <span className="text-xs text-gray-500">{req.submitterName}</span>
          {req.projectName && (
            <span className="text-xs text-gray-400 truncate max-w-[120px]">{req.projectName}</span>
          )}
        </div>
        {cardType === "tracking" && (
          <p className="text-xs text-gray-400 mt-1">
            下一步：{NEXT_STEP[req.status]}
            {daysStuck > 0 && <span className="ml-2 text-gray-300">· 停留 {daysStuck} 天</span>}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-gray-800 tabular-nums">
          NT${req.amount.toLocaleString("zh-TW")}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {new Date(req.updatedAt).toLocaleDateString("zh-TW")}
        </div>
      </div>
      <Link
        href={`/requests/${req.id}`}
        className="shrink-0 mt-0.5 p-1 text-gray-300 hover:text-blue-500 transition-colors"
        title="查看詳情"
      >
        <ExternalLink size={14} />
      </Link>
    </div>
  );
}

function WorkbenchCard({ card }: { card: WorkbenchCardConfig }) {
  const [open, setOpen] = useState(false);
  const colors = colorMap[card.color];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{card.title}</span>
            {card.count > 0 && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${colors.badge}`}>
                {card.count}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
        </div>
        {open
          ? <ChevronUp size={15} className="text-gray-400 shrink-0" />
          : <ChevronDown size={15} className="text-gray-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-2">
          {card.items.length === 0 ? (
            <p className="text-sm text-gray-400 py-5 text-center">目前沒有資料</p>
          ) : (
            <>
              {card.items.map((req) => (
                <RequestRow key={req.id} req={req} cardType={card.cardType} />
              ))}
              {card.count > card.items.length && (
                <div className="pt-3 pb-1">
                  <Link
                    href={card.href}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    查看全部 {card.count} 筆 →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkbenchSection({ cards }: { cards: WorkbenchCardConfig[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">我的工作台</h2>
      <div className="space-y-2">
        {cards.map((card) => (
          <WorkbenchCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
