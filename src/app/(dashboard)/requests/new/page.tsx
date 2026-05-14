import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewRequestForm } from "@/components/forms/NewRequestForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { UserRole } from "@prisma/client";

export default async function NewRequestPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!["APPLICANT", "ADMIN", "FINANCE"].includes(role)) {
    redirect("/requests");
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/requests" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={14} />
          返回列表
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">新增申請單</h1>
      </div>
      <NewRequestForm />
    </div>
  );
}
