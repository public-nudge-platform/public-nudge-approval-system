export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { Timeline } from "@/components/ui/Timeline";
import { AttachmentGrid } from "@/components/ui/AttachmentViewer";
import { ApprovalActionForm } from "@/components/forms/ApprovalActionForm";
import { MarkAsPaidForm } from "@/components/forms/MarkAsPaidForm";
import { SettlementForm } from "@/components/forms/SettlementForm";
import { SettlementReviewForm } from "@/components/forms/SettlementReviewForm";
import { FinanceReturnForm, WithdrawRequestForm } from "@/components/forms/RequestWorkflowForms";
import type { TimelineStep } from "@/components/ui/Timeline";
import type { UserRole } from "@prisma/client";
import { APPROVAL_ROLES, FINANCE_ROLES, OFFSET_REVIEW_ROLES, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import Link from "next/link";
import { ChevronLeft, Calendar, User, Building2, Banknote, FolderOpen, Hash, Receipt, Info, Pencil, BookOpen, Download } from "lucide-react";
import { FinalAccountingSubjectForm } from "@/components/forms/FinalAccountingSubjectForm";
import { PaymentAdjustmentSection } from "@/components/forms/PaymentAdjustmentSection";
import { UploadZone } from "@/components/ui/UploadZone";

const OFFSET_STATUSES = ["PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED", "CLOSED"] as const;
const PAID_STATUSES = ["PAID", "PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED", "CLOSED"] as const;
const EDITABLE_STATUSES = ["DRAFT", "WITHDRAWN", "RETURNED"] as const;

function buildTimeline(request: Awaited<ReturnType<typeof getRequest>>): TimelineStep[] {
  const status = request!.status;
  const steps: TimelineStep[] = [];

  steps.push({
    id: "created",
    title: "申請人建立",
    person: request!.submitter.name,
    date: request!.createdAt.toLocaleString("zh-TW"),
    status: "completed",
  });

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

  if (request!.approvalSteps.length === 0) {
    steps.push({ id: "approval", title: "理事長審核", status: "pending" });
  }

  if (status === "WITHDRAWN") {
    steps.push({ id: "withdrawn", title: "申請人抽回", status: "returned" });
    return steps;
  }

  if (status === "RETURNED") return steps;
  if (status === "REJECTED") return steps;

  const isPaid = (PAID_STATUSES as readonly string[]).includes(status);
  if (isPaid) {
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

  if (request!.type === "PREPAID") {
    if (status === "CLOSED") {
      steps.push({
        id: "settlement",
        title: "沖銷完成",
        person: request!.offsetReviewedBy ?? undefined,
        date: request!.offsetReviewedAt?.toLocaleString("zh-TW"),
        status: "completed",
      });
    } else if (status === "OFFSET_SUBMITTED") {
      steps.push({
        id: "settlement",
        title: "沖銷待確認",
        date: request!.reimbursementSubmittedAt?.toLocaleString("zh-TW"),
        status: "current",
      });
    } else if (status === "OFFSET_RETURNED") {
      steps.push({
        id: "settlement",
        title: "沖銷退回補件",
        comment: request!.offsetReviewNote ?? undefined,
        status: "returned",
      });
    } else if (status === "PENDING_SETTLEMENT") {
      steps.push({
        id: "settlement",
        title: "待申請人送出沖銷",
        status: "current",
      });
    } else {
      steps.push({ id: "settlement", title: "沖銷", status: "pending" });
    }
    // "沖銷完成" is the final step for PREPAID — no separate "案件結案" step needed.
  }
  // For REIMBURSEMENT, "財務付款完成" is the final step — no separate "案件結案" step needed.

  return steps;
}

async function getRequest(id: string) {
  return prisma.request.findUnique({
    where: { id },
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true, status: true } },
      items: true,
      attachments: true,
      accountingSubject: { select: { id: true, code: true, name: true, direction: true } },
      finalAccountingSubject: { select: { id: true, code: true, name: true, direction: true } },
      paymentAdjustments: {
        orderBy: { occurredAt: "asc" },
        include: {
          accountingSubject: { select: { id: true, code: true, name: true } },
          createdBy: { select: { name: true } },
        },
      },
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

async function getActiveRecipients() {
  return prisma.paymentRecipient.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

async function getActiveAccountingSubjects() {
  return prisma.accountingSubject.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, direction: true },
  });
}

async function getActiveFinancialAccounts() {
  return prisma.financialAccount.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const returnTo = from && from.startsWith("/") ? from : "/requests";
  const [request, session] = await Promise.all([getRequest(id), auth()]);

  if (!request) notFound();

  const role = session!.user.role as UserRole;
  const userId = session!.user.id;
  const canViewAll = (["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"] as UserRole[]).includes(role);
  if (!canViewAll && request.submitterId !== userId) notFound();

  const canMarkPaidEarly = ["FINANCE", "ADMIN"].includes(session!.user.role) && request.status === "APPROVED";
  const canEditFinalSubject = ["FINANCE", "ADMIN"].includes(role);
  const canWriteAdjustment = (["FINANCE", "ADMIN"] as UserRole[]).includes(role) &&
    (["PAID", "PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED", "CLOSED"] as readonly string[]).includes(request.status);
  const [activeRecipients, accountingSubjects, financialAccounts] = await Promise.all([
    canMarkPaidEarly ? getActiveRecipients() : Promise.resolve([]),
    (canEditFinalSubject || canWriteAdjustment) ? getActiveAccountingSubjects() : Promise.resolve([]),
    canMarkPaidEarly ? getActiveFinancialAccounts() : Promise.resolve([]),
  ]);

  const isApprover = APPROVAL_ROLES.includes(role) || role === "ADMIN";
  const isFinance = FINANCE_ROLES.includes(role);
  const pendingStep = request.status === "PENDING"
    ? request.approvalSteps.find((s) => s.records.length === 0)
    : null;
  const canApprove = isApprover && !!pendingStep;
  const canMarkPaid = ["FINANCE", "ADMIN"].includes(role) && request.status === "APPROVED";
  const canFinanceReturn = ["FINANCE", "ADMIN"].includes(role) && request.status === "APPROVED" && !request.paidAt;

  const isOwner = request.submitterId === userId;
  const hasApprovalRecord = request.approvalSteps.some((step) => step.records.length > 0);
  const canWithdraw = isOwner && request.status === "PENDING" && !hasApprovalRecord;
  const canEdit = isOwner && (EDITABLE_STATUSES as readonly string[]).includes(request.status);
  const lockedStatuses = ["PENDING", "APPROVED", "REJECTED", "PAID", "PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED", "CLOSED"] as const;
  const isLocked = (lockedStatuses as readonly string[]).includes(request.status);
  const canUpload = (isOwner || role === "ADMIN") && !isLocked;
  const canDelete = (isOwner || role === "ADMIN") && !isLocked;

  const isPrepaid = request.type === "PREPAID";
  const isInOffsetFlow = isPrepaid && (OFFSET_STATUSES as readonly string[]).includes(request.status);

  const settlementAttachments = request.attachments.filter((a) => a.isSettlement);
  const paymentAttachments = request.attachments.filter((a) => a.isPayment);
  const regularAttachments = request.attachments.filter((a) => !a.isSettlement && !a.isPayment);

  const canSubmitOffset =
    isPrepaid &&
    isOwner &&
    (request.status === "PENDING_SETTLEMENT" || request.status === "OFFSET_RETURNED");

  const canReviewOffset =
    isPrepaid &&
    (OFFSET_REVIEW_ROLES.includes(role) || role === "ADMIN") &&
    request.status === "OFFSET_SUBMITTED";

  const prepaidAmount = Number(request.amount);
  const actualAmount = request.actualAmount ? Number(request.actualAmount) : null;
  const amountDiff = actualAmount !== null ? actualAmount - prepaidAmount : null;

  const timeline = buildTimeline(request);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={returnTo} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3">
          <ChevronLeft size={14} />返回列表
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {request.requestNumber && (
                <span className="font-mono text-sm text-gray-500">{request.requestNumber}</span>
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
            <p className="text-xs text-gray-500">申請金額</p>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {Number(request.amount).toLocaleString()}
              <span className="text-base font-normal text-gray-500 ml-1">元</span>
            </p>
            {isFinance && (request.status === "PAID" || request.status === "CLOSED") && (
              <a
                href={`/api/export/requests/${request.id}`}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
              >
                <Download size={12} />匯出請款單 Excel
              </a>
            )}
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
                  <dt className="text-xs text-gray-500 mb-0.5">支出用途</dt>
                  <dd className="text-gray-700">{request.purpose}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Accounting subjects */}
          {(request.accountingSubject || request.finalAccountingSubject || isFinance) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={14} className="text-teal-600" />
                <h2 className="text-sm font-semibold text-gray-700">會計科目</h2>
              </div>
              <dl className="space-y-3 text-sm">
                {request.accountingSubject && (
                  <div>
                    <dt className="text-xs text-gray-500 mb-0.5">申請會計科目</dt>
                    <dd className="text-gray-800 font-medium font-mono">
                      {request.accountingSubject.code} {request.accountingSubject.name}
                      {request.accountingSubject.direction && (
                        <span className="ml-1 text-xs text-gray-500">（{request.accountingSubject.direction}）</span>
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-gray-500 mb-0.5">正式會計科目</dt>
                  {request.finalAccountingSubject ? (
                    <dd className={`font-medium font-mono ${
                      request.finalAccountingSubjectId !== request.accountingSubjectId
                        ? "text-amber-700"
                        : "text-gray-800"
                    }`}>
                      {request.finalAccountingSubject.code} {request.finalAccountingSubject.name}
                      {request.finalAccountingSubject.direction && (
                        <span className="ml-1 text-xs text-gray-500">（{request.finalAccountingSubject.direction}）</span>
                      )}
                      {request.finalAccountingSubjectId !== request.accountingSubjectId && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">（已由財務修正）</span>
                      )}
                    </dd>
                  ) : (
                    <dd className="text-gray-400 text-xs">尚未設定</dd>
                  )}
                </div>
              </dl>
              {canEditFinalSubject && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <FinalAccountingSubjectForm
                    requestId={request.id}
                    currentFinalSubjectId={request.finalAccountingSubjectId}
                    accountingSubjects={accountingSubjects}
                  />
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">費用明細</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left pb-2 font-medium">品項</th>
                  <th className="text-center pb-2 font-medium w-28">憑證日期</th>
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
                      {item.note && <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>}
                    </td>
                    <td className="py-2.5 text-center text-gray-600 tabular-nums">
                      {item.voucherDate
                        ? `${item.voucherDate.getFullYear()}/${item.voucherDate.getMonth() + 1}/${item.voucherDate.getDate()}`
                        : <span className="text-gray-300">未填寫</span>}
                    </td>
                    <td className="py-2.5 text-center text-gray-600 tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 text-right text-gray-600 tabular-nums">{Number(item.unitPrice).toLocaleString()}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900 tabular-nums">{Number(item.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="pt-3 text-right text-sm font-semibold text-gray-700">合計</td>
                  <td className="pt-3 text-right text-base font-bold text-gray-900 tabular-nums">
                    {Number(request.amount).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Regular Attachments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">申請附件</h2>
            <AttachmentGrid attachments={regularAttachments} canDelete={canDelete} />
            {canUpload && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-2">新增附件</p>
                <UploadZone requestId={request.id} />
              </div>
            )}
          </div>

          {/* Offset section — PREPAID only, in offset flow */}
          {isInOffsetFlow && (
            <div className={`bg-white rounded-xl border p-5 ${
              request.status === "OFFSET_RETURNED"
                ? "border-orange-200 ring-1 ring-orange-100"
                : "border-indigo-200 ring-1 ring-indigo-100"
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={15} className={request.status === "OFFSET_RETURNED" ? "text-orange-600" : "text-indigo-600"} />
                <h2 className="text-sm font-semibold text-gray-700">沖銷資訊</h2>
              </div>

              {/* Show submitted offset data */}
              {(request.status === "OFFSET_SUBMITTED" || request.status === "CLOSED" || (request.status === "OFFSET_RETURNED" && actualAmount !== null)) && (
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500 mb-0.5">預付金額</dt>
                      <dd className="font-semibold text-gray-900 tabular-nums">{prepaidAmount.toLocaleString()} 元</dd>
                    </div>
                    {actualAmount !== null && (
                      <div>
                        <dt className="text-xs text-gray-500 mb-0.5">實際支出</dt>
                        <dd className="font-semibold text-gray-900 tabular-nums">{actualAmount.toLocaleString()} 元</dd>
                      </div>
                    )}
                  </div>

                  {amountDiff !== null && (
                    <div className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${
                      amountDiff === 0 ? "bg-green-50 text-green-700 border-green-200" :
                      amountDiff < 0 ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      <Info size={12} />
                      {amountDiff === 0 && "金額相符"}
                      {amountDiff < 0 && `需繳回差額 ${Math.abs(amountDiff).toLocaleString()} 元`}
                      {amountDiff > 0 && `超支 ${amountDiff.toLocaleString()} 元，需另行請款`}
                    </div>
                  )}

                  {request.reimbursementNote && (
                    <div>
                      <dt className="text-xs text-gray-500 mb-0.5">沖銷說明</dt>
                      <dd className="text-sm text-gray-700">{request.reimbursementNote}</dd>
                    </div>
                  )}

                  {request.reimbursementSubmittedAt && (
                    <div>
                      <dt className="text-xs text-gray-500 mb-0.5">沖銷送出時間</dt>
                      <dd className="text-sm text-gray-700">{request.reimbursementSubmittedAt.toLocaleString("zh-TW")}</dd>
                    </div>
                  )}

                  {settlementAttachments.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">沖銷附件</p>
                      <AttachmentGrid attachments={settlementAttachments} canDelete={false} />
                    </div>
                  )}
                </div>
              )}

              {/* CLOSED: show review info */}
              {request.status === "CLOSED" && request.offsetReviewedAt && (
                <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                  {request.offsetReviewedBy && (
                    <p className="text-xs text-green-700 font-medium">
                      已由{request.offsetReviewedBy}於{" "}
                      {request.offsetReviewedAt.toLocaleDateString("zh-TW")} 完成沖銷確認
                    </p>
                  )}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>確認時間</span>
                    <span>{request.offsetReviewedAt.toLocaleString("zh-TW")}</span>
                  </div>
                </div>
              )}

              {/* PENDING_SETTLEMENT or OFFSET_RETURNED: show attachment list before submission */}
              {(request.status === "PENDING_SETTLEMENT" || request.status === "OFFSET_RETURNED") && isOwner && settlementAttachments.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">已上傳沖銷附件</p>
                  <AttachmentGrid attachments={settlementAttachments} canDelete={true} />
                </div>
              )}
            </div>
          )}

          {/* Payment info (if available) */}
          {(request.recipientName || request.bankName || request.bankCode || request.branchName || request.branchCode || request.bankAccountNumber || request.paymentInfoNote || (request.paymentMethod && !(PAID_STATUSES as readonly string[]).includes(request.status))) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">收款資訊</h2>
              <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
                {request.paymentMethod && !(PAID_STATUSES as readonly string[]).includes(request.status) && (
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
                {request.bankAccountNumber && (
                  <InfoRow icon={Building2} label="銀行帳號" value={request.bankAccountNumber} />
                )}
              </dl>
              {request.paymentInfoNote && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                  <dt className="text-xs text-gray-500 mb-0.5">備註</dt>
                  <dd className="text-gray-700">{request.paymentInfoNote}</dd>
                </div>
              )}
            </div>
          )}

          {/* Payment adjustment records */}
          {(PAID_STATUSES as readonly string[]).includes(request.status) && (
            <div id="payment-adjustments">
            <PaymentAdjustmentSection
              requestId={request.id}
              adjustments={request.paymentAdjustments.map((a) => ({
                ...a,
                amount: Number(a.amount),
              }))}
              canWrite={canWriteAdjustment}
              accountingSubjects={accountingSubjects}
            />
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Approval actions */}
          {(canEdit || canWithdraw) && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 ring-1 ring-slate-100 space-y-3">
              {canEdit && (
                <Link
                  href={`/requests/${request.id}/edit?from=${encodeURIComponent(returnTo)}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Pencil size={13} />
                  編輯申請單
                </Link>
              )}
              {canWithdraw && <WithdrawRequestForm requestId={request.id} />}
            </div>
          )}

          {/* Approval actions */}
          {canApprove && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 ring-1 ring-blue-100">
              <ApprovalActionForm requestId={request.id} stepId={pendingStep!.id} />
            </div>
          )}

          {/* Payment action */}
          {canMarkPaid && (
            <div className="bg-white rounded-xl border border-green-200 p-5 ring-1 ring-green-100 space-y-4">
              <MarkAsPaidForm
                requestId={request.id}
                defaultPaymentMethod={request.paymentMethod ?? undefined}
                recipients={activeRecipients}
                accountingSubjects={accountingSubjects}
                currentFinalSubjectId={request.finalAccountingSubjectId}
                financialAccounts={financialAccounts}
              />
              {canFinanceReturn && (
                <div className="border-t border-green-100 pt-4">
                  <FinanceReturnForm requestId={request.id} />
                </div>
              )}
            </div>
          )}

          {/* Offset form (applicant submits) */}
          {canSubmitOffset && (
            <div className="bg-white rounded-xl border border-indigo-200 p-5 ring-1 ring-indigo-100">
              <SettlementForm
                requestId={request.id}
                prepaidAmount={prepaidAmount}
                settlementAttachmentsCount={settlementAttachments.length}
                status={request.status as "PENDING_SETTLEMENT" | "OFFSET_RETURNED"}
                offsetReviewNote={request.offsetReviewNote}
              />
            </div>
          )}

          {/* Offset review form (finance reviews) */}
          {canReviewOffset && (
            <div className="bg-white rounded-xl border border-teal-200 p-5 ring-1 ring-teal-100">
              <SettlementReviewForm requestId={request.id} />
            </div>
          )}

          {/* Payment record */}
          {(PAID_STATUSES as readonly string[]).includes(request.status) && request.paidAt && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Banknote size={14} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-700">付款資訊</h2>
              </div>
              <dl className="space-y-2 text-sm">
                {request.paymentMethod && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">付款方式</dt>
                    <dd className="text-gray-800 font-medium">
                      {PAYMENT_METHOD_LABEL[request.paymentMethod] ?? request.paymentMethod}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">付款日期</dt>
                  <dd className="text-gray-800">{request.paidAt.toLocaleDateString("zh-TW")}</dd>
                </div>
                {request.paymentRecipientName && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">付款對象</dt>
                    <dd className="text-gray-800 font-medium">{request.paymentRecipientName}</dd>
                  </div>
                )}
                {request.bankLastFive && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">匯款帳號後五碼</dt>
                    <dd className="text-gray-800 font-mono">*{request.bankLastFive}</dd>
                  </div>
                )}
                {request.paidBy && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">付款處理人</dt>
                    <dd className="text-gray-800">{request.paidBy}</dd>
                  </div>
                )}
                {request.paymentNote && (
                  <div className="pt-1 border-t border-gray-100">
                    <dt className="text-gray-500 mb-0.5">付款備註</dt>
                    <dd className="text-gray-700">{request.paymentNote}</dd>
                  </div>
                )}
              </dl>
              {paymentAttachments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">付款證明附件</p>
                  <AttachmentGrid attachments={paymentAttachments} canDelete={false} />
                </div>
              )}
              {(() => {
                const adjTotal = request.paymentAdjustments.reduce((s, a) => s + Number(a.amount), 0);
                if (adjTotal <= 0) return null;
                const baseAmt = Number(request.amount);
                return (
                  <div className="mt-3 pt-3 border-t border-blue-100 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>原請款金額</span>
                      <span className="tabular-nums">{baseAmt.toLocaleString()} 元</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>付款調整總額</span>
                      <span className="tabular-nums text-blue-600">+ {adjTotal.toLocaleString()} 元</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-1.5">
                      <span>最終支出金額</span>
                      <span className="tabular-nums">{(baseAmt + adjTotal).toLocaleString()} 元</span>
                    </div>
                  </div>
                );
              })()}
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
      <dt className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
        <Icon size={11} />
        {label}
      </dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
