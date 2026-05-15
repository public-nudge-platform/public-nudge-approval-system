export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { Timeline } from "@/components/ui/Timeline";
import { AttachmentGrid } from "@/components/ui/AttachmentViewer";
import { ApprovalActionForm } from "@/components/forms/ApprovalActionForm";
import { MarkAsPaidForm } from "@/components/forms/MarkAsPaidForm";
import type { TimelineStep } from "@/components/ui/Timeline";
import type { UserRole } from "@prisma/client";
import { APPROVAL_ROLES, FINANCE_ROLES } from "@/lib/constants";
import Link from "next/link";
import { ChevronLeft, Calendar, User, Building2, Banknote, FolderOpen, Hash } from "lucide-react";
import { UploadZone } from "@/components/ui/UploadZone";

function buildTimeline(request: Awaited<ReturnType<typeof getRequest>>): TimelineStep[] {
  const status = request!.status;
  const steps: TimelineStep[] = [];

  // 1. 申請人建立
  steps.push({
    id: "created",
    title: "申請人建立",
    person: request!.submitter.name,
    date: request!.createdAt.toLocaleString("zh-TW"),
    status: "completed",
  });

  // 2. 送出申請
  if (request!.submittedAt) {
    steps.push({
      id: "submitted",
      title: "送出申請",
      person: request!.submitter.name,
      date: request!.submittedAt.toLocaleString("zh-TW"),
      status: "completed",
    });
  } else {
    steps.push({ id: "submitted", title: "送出申請", status: "pending" });
  }

  // 3. 簽核步驟
  for (const step of request!.approvalSteps) {
    const lastRecord = step.records[step.records.length - 1];
    if (lastRecord) {
      const actionMap = { APPROVED: "completed", REJECTED: "rejected", RETURNED: "returned" } as const;
      const actionLabel = { APPROVED: "核准", REJECTED: "拒絕", RETURNED: "退回修改" }[lastRecord.action];
      steps.push({
        id: step.id,
        title: `${step.title}：${actionLabel}`,
        person: lastRecord.approver.name,
        date: lastRecord.actedAt.toLocaleString("zh-TW"),
        comment: lastRecord.comment ?? undefined,
        status: actionMap[lastRecord.action],
      });
    } else {
      steps.push({
        id: step.id,
        title: step.title,
        status: status === "PENDING" ? "current" : "pending",
      });
    }
  }

  // 若尚未建立簽核步驟（草稿），補上預設步驟
  if (request!.approvalSteps.length === 0) {
    steps.push({ id: "approval", title: "理事長審核", status: "pending" });
  }

  // 若已拒絕，後續步驟不顯示
  if (status === "REJECTED") return steps;

  // 4. 財務付款
  if (status === "PAID" || status === "CLOSED") {
    steps.push({
      id: "paid",
      title: "財務付款完成",
      person: request!.paidBy ?? undefined,
      date: request!.paidAt?.toLocaleString("zh-TW"),
      status: "completed",
    });
  } else {
    steps.push({
      id: "paid",
      title: "財務付款",
      status: status === "APPROVED" ? "current" : "pending",
    });
  }

  // 5. 結案
  steps.push({
    id: "closed",
    title: "案件結案",
    status: status === "CLOSED" ? "completed" : "pending",
  });

  return steps;
}

async function getRequest(id: string) {
  return prisma.request.findUnique({
    where: { id },
    include: {
      submitter: { select: { name: true, email: true } },
      project: { select: { id: true, name: true, status: true } },
      items: true,
      attachments: true,
      approvalSteps: {
        orderBy: { stepOrder: "asc" },
        include: {
          records: {
            orderBy: { actedAt: "asc" },
            include: { approver: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [request, session] = await Promise.all([getRequest(id), auth()]);

  if (!request) notFound();

  const role = session!.user.role as UserRole;
  const userId = session!.user.id;
  const isApprover = APPROVAL_ROLES.includes(role) || role === "ADMIN";
  const isFinance = FINANCE_ROLES.includes(role);
  const pendingStep = request.status === "PENDING"
    ? request.approvalSteps.find((s) => s.records.length === 0)
    : null;
  const canApprove = isApprover && !!pendingStep;
  const canMarkPaid = isFinance && request.status === "APPROVED";

  const isOwner = request.submitterId === userId;
  const lockedStatuses = ["APPROVED", "PAID", "CLOSED"] as const;
  const isLocked = (lockedStatuses as readonly string[]).includes(request.status);
  const canUpload = (isOwner || role === "ADMIN") && !isLocked;
  const canDelete = (isOwner || role === "ADMIN") && !isLocked;

  const timeline = buildTimeline(request);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/requests" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3">
          <ChevronLeft size={14} />返回列表
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {request.requestNumber && (
                <span className="font-mono text-sm text-gray-400">{request.requestNumber}</span>
              )}
              <TypeBadge type={request.type} />
              <StatusBadge status={request.status} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{request.title}</h1>
            {request.project && (
              <p className="text-sm text-gray-500 mt-0.5">{request.project.name}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">申請金額</p>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {Number(request.amount).toLocaleString()}
              <span className="text-base font-normal text-gray-400 ml-1">元</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">申請資訊</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow icon={User} label="申請人" value={request.submitter.name} />
              <InfoRow icon={Calendar} label="申請日期" value={request.requestDate.toLocaleDateString("zh-TW")} />
              {request.project && (
                <InfoRow icon={FolderOpen} label="專案" value={request.project.name} />
              )}
              {request.requestNumber && (
                <InfoRow icon={Hash} label="流水編號" value={request.requestNumber} />
              )}
              {request.neededBy && (
                <InfoRow icon={Calendar} label="需款期限" value={request.neededBy.toLocaleDateString("zh-TW")} />
              )}
              {request.purpose && (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-400 mb-0.5">支出用途</dt>
                  <dd className="text-gray-700">{request.purpose}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">費用明細</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left pb-2 font-medium">品項</th>
                  <th className="text-center pb-2 font-medium w-16">數量</th>
                  <th className="text-right pb-2 font-medium w-24">單價</th>
                  <th className="text-right pb-2 font-medium w-24">小計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {request.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5">
                      <p className="text-gray-900">{item.description}</p>
                      {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                    </td>
                    <td className="py-2.5 text-center text-gray-600 tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 text-right text-gray-600 tabular-nums">{Number(item.unitPrice).toLocaleString()}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900 tabular-nums">{Number(item.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-sm font-semibold text-gray-600">合計</td>
                  <td className="pt-3 text-right text-base font-bold text-gray-900 tabular-nums">
                    {Number(request.amount).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">附件</h2>
            <AttachmentGrid attachments={request.attachments} canDelete={canDelete} />
            {canUpload && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">新增附件</p>
                <UploadZone requestId={request.id} />
              </div>
            )}
          </div>

          {/* Payment info (if available) */}
          {(request.recipientName || request.bankName || request.bankCode || request.branchName || request.branchCode || request.paymentInfoNote || (request.paymentMethod && request.status !== "PAID")) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">收款資訊</h2>
              <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
                {request.paymentMethod && request.status !== "PAID" && (
                  <InfoRow icon={Banknote} label="希望付款方式" value={request.paymentMethod} />
                )}
                {request.recipientName && (
                  <InfoRow icon={User} label="收款人" value={request.recipientName} />
                )}
                {request.bankName && (
                  <InfoRow icon={Building2} label="銀行名稱" value={request.bankName} />
                )}
                {request.bankCode && (
                  <InfoRow icon={Building2} label="銀行代碼" value={request.bankCode} />
                )}
                {request.branchName && (
                  <InfoRow icon={Building2} label="分行名稱" value={request.branchName} />
                )}
                {request.branchCode && (
                  <InfoRow icon={Building2} label="分行代碼" value={request.branchCode} />
                )}
              </dl>
              {request.paymentInfoNote && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                  <dt className="text-xs text-gray-400 mb-0.5">備註</dt>
                  <dd className="text-gray-700">{request.paymentInfoNote}</dd>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Approval actions */}
          {canApprove && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 ring-1 ring-blue-100">
              <ApprovalActionForm requestId={request.id} stepId={pendingStep!.id} />
            </div>
          )}

          {/* Payment action */}
          {canMarkPaid && (
            <div className="bg-white rounded-xl border border-green-200 p-5 ring-1 ring-green-100">
              <MarkAsPaidForm requestId={request.id} defaultPaymentMethod={request.paymentMethod ?? undefined} />
            </div>
          )}

          {/* Payment record (if paid) */}
          {request.status === "PAID" && request.paidAt && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Banknote size={14} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-700">付款資訊</h2>
              </div>
              <dl className="space-y-2 text-sm">
                {request.paymentMethod && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">付款方式</dt>
                    <dd className="text-gray-800 font-medium">{request.paymentMethod}</dd>
                  </div>
                )}
                {request.paymentReference && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">憑證編號</dt>
                    <dd className="text-gray-800 font-mono text-xs">{request.paymentReference}</dd>
                  </div>
                )}
                {request.paidBy && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">付款人</dt>
                    <dd className="text-gray-800">{request.paidBy}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-400">付款日期</dt>
                  <dd className="text-gray-800">{request.paidAt.toLocaleDateString("zh-TW")}</dd>
                </div>
                {request.paymentNote && (
                  <div className="pt-1 border-t border-gray-100">
                    <dt className="text-gray-400 mb-0.5">備註</dt>
                    <dd className="text-gray-700">{request.paymentNote}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">簽核流程記錄</h2>
            <Timeline steps={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
        <Icon size={11} />
        {label}
      </dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
