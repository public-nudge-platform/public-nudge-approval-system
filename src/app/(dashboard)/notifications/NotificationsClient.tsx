"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notification";
import {
  Bell, FileText, CheckCircle2, XCircle, RotateCcw,
  Banknote, Receipt, Send, Archive, SmartphoneNfc,
} from "lucide-react";
import { clsx } from "clsx";
import type { NotificationType } from "@prisma/client";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedRequestId: string | null;
  isRead: boolean;
  createdAt: Date;
};

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ size?: number; className?: string }>> = {
  REQUEST_SUBMITTED: Send,
  APPROVAL_ASSIGNED: FileText,
  REQUEST_WITHDRAWN: RotateCcw,
  REQUEST_APPROVED: CheckCircle2,
  REQUEST_RETURNED: RotateCcw,
  REQUEST_REJECTED: XCircle,
  PAYMENT_COMPLETED: Banknote,
  REIMBURSEMENT_REQUIRED: Receipt,
  SETTLEMENT_SUBMITTED: Receipt,
  SETTLEMENT_RETURNED: RotateCcw,
  SETTLEMENT_APPROVED: CheckCircle2,
  REQUEST_CLOSED: Archive,
  PAYMENT_ADJUSTMENT_ADDED: Banknote,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  REQUEST_SUBMITTED: "text-blue-500 bg-blue-50",
  APPROVAL_ASSIGNED: "text-purple-500 bg-purple-50",
  REQUEST_WITHDRAWN: "text-slate-500 bg-slate-100",
  REQUEST_APPROVED: "text-green-500 bg-green-50",
  REQUEST_RETURNED: "text-amber-500 bg-amber-50",
  REQUEST_REJECTED: "text-red-500 bg-red-50",
  PAYMENT_COMPLETED: "text-emerald-500 bg-emerald-50",
  REIMBURSEMENT_REQUIRED: "text-orange-500 bg-orange-50",
  SETTLEMENT_SUBMITTED: "text-indigo-500 bg-indigo-50",
  SETTLEMENT_RETURNED: "text-amber-500 bg-amber-50",
  SETTLEMENT_APPROVED: "text-purple-500 bg-purple-50",
  REQUEST_CLOSED: "text-gray-500 bg-gray-100",
  PAYMENT_ADJUSTMENT_ADDED: "text-blue-500 bg-blue-50",
};

type PushState = "unsupported" | "default" | "granted" | "denied" | "loading";

function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PushState);
  }, []);

  async function enable() {
    setState("loading");
    try {
      const res = await fetch("/api/push/subscribe");
      const { vapidPublicKey } = await res.json();
      if (!vapidPublicKey) {
        setState("unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState("granted");
    } catch {
      setState(Notification.permission as PushState);
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } catch {
      setState("default");
    }
  }

  return { state, enable, disable };
}

function PushToggleButton() {
  const { state, enable, disable } = usePushNotifications();

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-400">
        <SmartphoneNfc size={15} />
        <span>偵測中…</span>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-400">
        <SmartphoneNfc size={15} />
        <span>此瀏覽器不支援手機推播</span>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
        <SmartphoneNfc size={15} />
        <span>推播已被封鎖，請至瀏覽器設定解除封鎖</span>
      </div>
    );
  }

  if (state === "granted") {
    return (
      <button
        onClick={disable}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 hover:bg-green-100 transition-colors"
      >
        <SmartphoneNfc size={15} />
        <span>手機推播已啟用（點此關閉）</span>
      </button>
    );
  }

  return (
    <button
      onClick={enable}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
    >
      <SmartphoneNfc size={15} />
      <span>啟用手機推播通知</span>
    </button>
  );
}

function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小時前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(date).toLocaleDateString("zh-TW");
}

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const colorCls = TYPE_COLOR[notification.type] ?? "text-gray-500 bg-gray-50";

  const inner = (
    <div className={clsx(
      "flex items-start gap-3 px-5 py-4 hover:bg-gray-50/60 transition-colors",
      !notification.isRead && "bg-blue-50/30"
    )}>
      <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", colorCls)}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={clsx("text-sm font-medium text-gray-900", !notification.isRead && "font-semibold")}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-gray-600 mt-0.5 leading-snug">{notification.message}</p>
        <p className="text-xs text-gray-500 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
    </div>
  );

  if (notification.relatedRequestId) {
    return (
      <li className="border-b border-gray-50 last:border-0">
        <Link href={`/requests/${notification.relatedRequestId}`} onClick={() => onRead(notification.id)}>
          {inner}
        </Link>
      </li>
    );
  }

  return (
    <li className="border-b border-gray-50 last:border-0">
      {inner}
    </li>
  );
}

export function NotificationsClient({ notifications, unreadCount }: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">通知中心</h1>
          {unreadCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {unreadCount} 未讀
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={pending}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition-colors"
          >
            全部標記已讀
          </button>
        )}
      </div>

      {/* Push notification toggle */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="text-sm text-gray-600">在手機或桌面上接收即時推播通知</div>
        <PushToggleButton />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">目前沒有任何通知</p>
          </div>
        ) : (
          <ul>
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={handleRead} />
            ))}
          </ul>
        )}
      </div>

      {notifications.length > 0 && (
        <p className="text-xs text-gray-500">共 {notifications.length} 則通知</p>
      )}
    </div>
  );
}
