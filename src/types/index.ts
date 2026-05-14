import type { User, Request, RequestItem, Attachment, ApprovalStep, ApprovalRecord } from "@prisma/client";

export type { User, Request, RequestItem, Attachment, ApprovalStep, ApprovalRecord };

export type RequestWithRelations = Request & {
  submitter: Pick<User, "id" | "name" | "email" | "department">;
  items: RequestItem[];
  attachments: Attachment[];
  approvalSteps: (ApprovalStep & {
    records: (ApprovalRecord & {
      approver: Pick<User, "id" | "name" | "email">;
    })[];
  })[];
};

export type SafeUser = Omit<User, "passwordHash">;
