import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewRequestForm } from "@/components/forms/NewRequestForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export default async function NewRequestPage() {
  await auth();

  const [projects, recipients, accountingSubjects] = await Promise.all([
    prisma.project.findMany({
      where: { status: "IN_PROGRESS" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentRecipient.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        bankName: true,
        bankCode: true,
        branchName: true,
        branchCode: true,
        bankAccountNumber: true,
        paymentInfoNote: true,
      },
    }),
    prisma.accountingSubject.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, direction: true },
    }),
  ]);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "首頁", href: "/dashboard" },
          { label: "請款單管理", href: "/requests" },
          { label: "新增申請單" },
        ]}
      />
      <div className="flex items-center gap-2 mb-6">
        <Link href="/requests" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={14} />
          返回列表
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">新增申請單</h1>
      </div>
      <NewRequestForm projects={projects} recipients={recipients} accountingSubjects={accountingSubjects} />
    </div>
  );
}
