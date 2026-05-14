import { REQUEST_STATUS_COLOR, REQUEST_STATUS_LABEL, REQUEST_TYPE_COLOR, REQUEST_TYPE_LABEL } from "@/lib/constants";
import type { RequestStatus, RequestType } from "@prisma/client";
import { clsx } from "clsx";

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", REQUEST_STATUS_COLOR[status])}>
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

export function TypeBadge({ type }: { type: RequestType }) {
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", REQUEST_TYPE_COLOR[type])}>
      {REQUEST_TYPE_LABEL[type]}
    </span>
  );
}
