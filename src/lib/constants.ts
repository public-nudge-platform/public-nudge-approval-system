import type { ProjectStatus, RequestStatus, RequestType, UserRole } from "@prisma/client";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT:              "草稿",
  PENDING:            "待審核",
  APPROVED:           "已核准，待付款",
  REJECTED:           "已拒絕",
  RETURNED:           "退回修改",
  PAID:               "已付款",
  PENDING_SETTLEMENT: "待核銷",
  CLOSED:             "已結案",
};

export const REQUEST_STATUS_COLOR: Record<RequestStatus, string> = {
  DRAFT:              "bg-gray-100 text-gray-600",
  PENDING:            "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  APPROVED:           "bg-green-50 text-green-700 ring-1 ring-green-200",
  REJECTED:           "bg-red-50 text-red-700 ring-1 ring-red-200",
  RETURNED:           "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  PAID:               "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  PENDING_SETTLEMENT: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  CLOSED:             "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  REIMBURSEMENT: "一般請款",
  PREPAID:       "預付請款",
};

export const REQUEST_TYPE_COLOR: Record<RequestType, string> = {
  REIMBURSEMENT: "bg-slate-100 text-slate-600",
  PREPAID:       "bg-indigo-50 text-indigo-600",
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

export const APPROVAL_ROLES: UserRole[] = ["PRESIDENT", "FOUNDER_AGENT"];
export const FINANCE_ROLES: UserRole[] = ["FINANCE", "ADMIN", "PRESIDENT", "FOUNDER_AGENT"];
export const ADMIN_ROLES: UserRole[] = ["ADMIN"];
export const PROJECT_MANAGE_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT"];
export const PROJECT_VIEW_ROLES: UserRole[] = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"];
