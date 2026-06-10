import type { AuditAction, PaymentAdjustmentType, ProjectStatus, RequestStatus, RequestType, UserRole } from "@prisma/client";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT:              "草稿",
  WITHDRAWN:          "已抽單",
  PENDING:            "待審核",
  APPROVED:           "已核准，待付款",
  REJECTED:           "已拒絕",
  RETURNED:           "退回修改",
  PAID:               "已付款",
  PENDING_SETTLEMENT: "待沖銷",
  OFFSET_SUBMITTED:   "沖銷待確認",
  OFFSET_RETURNED:    "沖銷退回補件",
  CLOSED:             "已沖銷",
};

// Status colors are grouped by meaning (not one hue per status) so the
// whole app uses a small, consistent palette:
//   灰 gray   = 草稿／已結束的中性狀態（不需任何人採取行動）
//   琥珀 amber = 等待他人處理中
//   橘 orange = 需要申請人修改後重新送出
//   紅 red    = 已拒絕（終止）
//   綠 green  = 已完成／成功
export const REQUEST_STATUS_COLOR: Record<RequestStatus, string> = {
  DRAFT:              "bg-gray-100 text-gray-600",
  WITHDRAWN:          "bg-gray-100 text-gray-600",
  PENDING:            "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  APPROVED:           "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  REJECTED:           "bg-red-50 text-red-700 ring-1 ring-red-200",
  RETURNED:           "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  PAID:               "bg-green-50 text-green-700 ring-1 ring-green-200",
  PENDING_SETTLEMENT: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  OFFSET_SUBMITTED:   "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  OFFSET_RETURNED:    "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  CLOSED:             "bg-green-50 text-green-700 ring-1 ring-green-200",
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  REIMBURSEMENT: "一般請款",
  PREPAID:       "預付請款",
};

// Type is informational, not actionable — keep both neutral so it doesn't
// compete with the status badge's color.
export const REQUEST_TYPE_COLOR: Record<RequestType, string> = {
  REIMBURSEMENT: "bg-gray-100 text-gray-600",
  PREPAID:       "bg-gray-100 text-gray-600",
};

// Shared accent-color palette for dashboard cards (StatsCard, WorkbenchSection).
// These colors are *categorical* (which section/queue a card represents),
// distinct from REQUEST_STATUS_COLOR which is *semantic* (what stage/who acts).
// Keeping one definition here ensures both components use the same shades.
export type AccentColor = "blue" | "amber" | "green" | "red" | "purple" | "slate";

export const ACCENT_COLOR: Record<AccentColor, { icon: string; value: string; dot: string; badge: string }> = {
  blue:   { icon: "bg-blue-50 text-blue-600",    value: "text-blue-700",   dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  amber:  { icon: "bg-amber-50 text-amber-600",  value: "text-amber-700",  dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  green:  { icon: "bg-green-50 text-green-600",  value: "text-green-700",  dot: "bg-green-400",  badge: "bg-green-50 text-green-700 border-green-200" },
  red:    { icon: "bg-red-50 text-red-600",      value: "text-red-700",    dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200" },
  purple: { icon: "bg-purple-50 text-purple-600", value: "text-purple-700", dot: "bg-purple-400", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  slate:  { icon: "bg-slate-100 text-slate-600", value: "text-slate-700",  dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-700 border-slate-200" },
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:         "系統管理員",
  PRESIDENT:     "理事長",
  FOUNDER_AGENT: "創會理事長",
  FINANCE:       "財務人員",
  SECRETARY:     "秘書長",
  DIRECTOR:      "理事",
  SUPERVISOR:    "監事",
  APPLICANT:     "申請人",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  NOT_STARTED: "尚未啟動",
  IN_PROGRESS: "進行中",
  CLOSED:      "已結案",
};

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  IN_PROGRESS: "bg-green-50 text-green-700 ring-1 ring-green-200",
  CLOSED:      "bg-gray-100 text-gray-500",
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: "BANK_TRANSFER", label: "銀行轉帳" },
  { value: "CASH",          label: "現金" },
  { value: "CHECK",         label: "支票" },
  { value: "OTHER",         label: "其他" },
] as const;

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "銀行轉帳",
  CASH:          "現金",
  CHECK:         "支票",
  OTHER:         "其他",
  銀行轉帳:       "銀行轉帳",
  現金:           "現金",
  支票:           "支票",
  信用卡:         "信用卡",
  其他:           "其他",
};

export const PAYMENT_ADJUSTMENT_TYPE_LABEL: Record<PaymentAdjustmentType, string> = {
  BANK_FEE:      "銀行手續費",
  TRANSFER_FEE:  "匯費",
  INTERBANK_FEE: "跨行費",
  OTHER:         "其他",
};

export const PAYMENT_ADJUSTMENT_TYPE_OPTIONS = [
  { value: "BANK_FEE",      label: "銀行手續費" },
  { value: "TRANSFER_FEE",  label: "匯費" },
  { value: "INTERBANK_FEE", label: "跨行費" },
  { value: "OTHER",         label: "其他" },
] as const;

export const APPROVAL_ROLES: UserRole[] = ["PRESIDENT", "FOUNDER_AGENT"];
export const FINANCE_ROLES: UserRole[] = ["FINANCE", "ADMIN", "PRESIDENT", "FOUNDER_AGENT"];
export const OFFSET_REVIEW_ROLES: UserRole[] = ["FINANCE", "PRESIDENT", "FOUNDER_AGENT"];
export const ADMIN_ROLES: UserRole[] = ["ADMIN"];
export const ACCOUNTING_MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"];
export const PROJECT_MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"];
export const PROJECT_VIEW_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  USER_LOGIN:            "使用者登入",
  REQUEST_CREATED:       "新增請款單",
  REQUEST_UPDATED:       "編輯請款單",
  REQUEST_SUBMITTED:     "送出請款單",
  REQUEST_WITHDRAWN:     "抽回請款單",
  REQUEST_APPROVED:      "核准請款單",
  REQUEST_RETURNED:      "退回請款單",
  REQUEST_REJECTED:      "拒絕請款單",
  PAYMENT_MARKED:        "財務標記付款",
  SETTLEMENT_SUBMITTED:  "送出沖銷",
  SETTLEMENT_RETURNED:   "沖銷退回",
  SETTLEMENT_APPROVED:   "沖銷完成",
  ATTACHMENT_UPLOADED:   "上傳附件",
  ATTACHMENT_DELETED:    "刪除附件",
  PROJECT_CREATED:       "新增專案",
  PROJECT_UPDATED:       "編輯專案",
  PROJECT_STATUS_CHANGED:"專案狀態變更",
  PROJECT_DELETED:       "刪除專案",
  USER_CREATED:          "新增使用者",
  USER_UPDATED:          "編輯使用者",
  USER_DEACTIVATED:      "停用使用者",
  PASSWORD_RESET:        "重設密碼",
  DATA_EXPORTED:              "匯出資料",
  ACCOUNTING_SUBJECT_CREATED:    "新增會計科目",
  ACCOUNTING_SUBJECT_UPDATED:    "編輯會計科目",
  ACCOUNTING_SUBJECT_DEACTIVATED:"停用會計科目",
  ACCOUNTING_SUBJECT_CHANGED:    "修改正式會計科目",
  PAYMENT_ADJUSTMENT_CREATED:    "新增付款調整",
  PAYMENT_ADJUSTMENT_UPDATED:    "編輯付款調整",
  PAYMENT_ADJUSTMENT_DELETED:    "刪除付款調整",
  TRANSACTION_CREATED:           "新增帳戶交易",
  TRANSACTION_UPDATED:           "編輯帳戶交易",
  TRANSACTION_DELETED:           "刪除帳戶交易",
  FINANCIAL_ACCOUNT_UPDATED:     "更新資金帳戶",
};

export const FINANCIAL_ACCOUNT_TYPE_LABEL: Record<string, string> = {
  POST_OFFICE: "郵局帳戶",
  BANK:        "銀行帳戶",
};

export const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  INCOME:  "入帳",
  EXPENSE: "出帳",
};

export const TRANSACTION_TYPE_COLOR: Record<string, string> = {
  INCOME:  "text-green-600",
  EXPENSE: "text-red-600",
};

export const FINANCE_VIEW_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"];

export const AUDIT_ACTION_COLOR: Record<AuditAction, string> = {
  USER_LOGIN:            "bg-gray-100 text-gray-600",
  REQUEST_CREATED:       "bg-blue-50 text-blue-700",
  REQUEST_UPDATED:       "bg-sky-50 text-sky-700",
  REQUEST_SUBMITTED:     "bg-amber-50 text-amber-700",
  REQUEST_WITHDRAWN:     "bg-slate-100 text-slate-700",
  REQUEST_APPROVED:      "bg-green-50 text-green-700",
  REQUEST_RETURNED:      "bg-orange-50 text-orange-700",
  REQUEST_REJECTED:      "bg-red-50 text-red-700",
  PAYMENT_MARKED:        "bg-teal-50 text-teal-700",
  SETTLEMENT_SUBMITTED:  "bg-indigo-50 text-indigo-700",
  SETTLEMENT_RETURNED:   "bg-orange-50 text-orange-700",
  SETTLEMENT_APPROVED:   "bg-purple-50 text-purple-700",
  ATTACHMENT_UPLOADED:   "bg-sky-50 text-sky-700",
  ATTACHMENT_DELETED:    "bg-red-50 text-red-600",
  PROJECT_CREATED:       "bg-blue-50 text-blue-700",
  PROJECT_UPDATED:       "bg-blue-50 text-blue-700",
  PROJECT_STATUS_CHANGED:"bg-violet-50 text-violet-700",
  PROJECT_DELETED:       "bg-red-50 text-red-700",
  USER_CREATED:          "bg-green-50 text-green-700",
  USER_UPDATED:          "bg-blue-50 text-blue-700",
  USER_DEACTIVATED:      "bg-red-50 text-red-700",
  PASSWORD_RESET:        "bg-amber-50 text-amber-700",
  DATA_EXPORTED:                 "bg-emerald-50 text-emerald-700",
  ACCOUNTING_SUBJECT_CREATED:    "bg-teal-50 text-teal-700",
  ACCOUNTING_SUBJECT_UPDATED:    "bg-teal-50 text-teal-700",
  ACCOUNTING_SUBJECT_DEACTIVATED:"bg-slate-100 text-slate-700",
  ACCOUNTING_SUBJECT_CHANGED:    "bg-violet-50 text-violet-700",
  PAYMENT_ADJUSTMENT_CREATED:    "bg-teal-50 text-teal-700",
  PAYMENT_ADJUSTMENT_UPDATED:    "bg-sky-50 text-sky-700",
  PAYMENT_ADJUSTMENT_DELETED:    "bg-red-50 text-red-700",
  TRANSACTION_CREATED:           "bg-emerald-50 text-emerald-700",
  TRANSACTION_UPDATED:           "bg-teal-50 text-teal-700",
  TRANSACTION_DELETED:           "bg-red-50 text-red-700",
  FINANCIAL_ACCOUNT_UPDATED:     "bg-blue-50 text-blue-700",
};
