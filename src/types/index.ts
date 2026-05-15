import type { User, Request, RequestItem, Attachment, ApprovalStep, ApprovalRecord, Project } from "@prisma/client";

export type { User, Request, RequestItem, Attachment, ApprovalStep, ApprovalRecord, Project };

export type RequestWithRelations = Request & {
  submitter: Pick<User, "id" | "name" | "email">;
  items: RequestItem[];
  attachments: Attachment[];
  project: Pick<Project, "id" | "name" | "status"> | null;
  approvalSteps: (ApprovalStep & {
    records: (ApprovalRecord & {
      approver: Pick<User, "id" | "name" | "email">;
    })[];
  })[];
};

export type SafeUser = Omit<User, "passwordHash">;
