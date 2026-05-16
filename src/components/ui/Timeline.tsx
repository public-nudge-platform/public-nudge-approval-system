import { clsx } from "clsx";
import { Check, X, RotateCcw, Clock, CircleDot } from "lucide-react";

export type TimelineStep = {
  id: string;
  title: string;
  person?: string;
  date?: string;
  comment?: string;
  status: "completed" | "rejected" | "returned" | "current" | "pending";
};

const stepConfig = {
  completed: {
    icon: Check,
    iconClass: "bg-green-500 text-white",
    lineClass: "bg-green-200",
    titleClass: "text-gray-900",
  },
  rejected: {
    icon: X,
    iconClass: "bg-red-500 text-white",
    lineClass: "bg-red-200",
    titleClass: "text-gray-900",
  },
  returned: {
    icon: RotateCcw,
    iconClass: "bg-orange-400 text-white",
    lineClass: "bg-orange-200",
    titleClass: "text-gray-900",
  },
  current: {
    icon: CircleDot,
    iconClass: "bg-blue-500 text-white",
    lineClass: "bg-gray-200",
    titleClass: "text-blue-700 font-medium",
  },
  pending: {
    icon: Clock,
    iconClass: "bg-gray-200 text-gray-500",
    lineClass: "bg-gray-100",
    titleClass: "text-gray-500",
  },
};

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const config = stepConfig[step.status];
        const Icon = config.icon;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10", config.iconClass)}>
                <Icon size={14} />
              </div>
              {!isLast && <div className={clsx("w-0.5 flex-1 my-1 min-h-4", config.lineClass)} />}
            </div>
            <div className={clsx("pb-5 min-w-0 flex-1", isLast && "pb-0")}>
              <p className={clsx("text-sm", config.titleClass)}>{step.title}</p>
              {step.person && (
                <p className="text-xs text-gray-600 mt-0.5">{step.person}</p>
              )}
              {step.date && (
                <p className="text-xs text-gray-500 mt-0.5">{step.date}</p>
              )}
              {step.comment && (
                <p className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1 mt-1.5 border border-gray-200">
                  「{step.comment}」
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
