export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewRequestForm } from "@/components/forms/NewRequestForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const EDITABLE_STATUSES = ["DRAFT", "WITHDRAWN", "RETURNED"] as const;

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" } },
    },
  });

  if (!request) notFound();
  if (request.submitterId !== session!.user.id) redirect(`/requests/${id}`);
  if (!(EDITABLE_STATUSES as readonly string[]).includes(request.status)) redirect(`/requests/${id}`);

  const [projects, recipients, accountingSubjects] = await Promise.all([
    prisma.project.findMany({
      where: {
        OR: [
          { status: "IN_PROGRESS" },
          ...(request.projectId ? [{ id: request.projectId }] : []),
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentRecipient.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.accountingSubject.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, direction: true },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/requests/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={14} />
          返回申請單
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">編輯申請單</h1>
      </div>
      <NewRequestForm
        projects={projects}
        recipients={recipients}
        accountingSubjects={accountingSubjects}
        initialRequest={{
          id: request.id,
          type: request.type,
          title: request.title,
          projectId: request.projectId,
          purpose: request.purpose,
          neededBy: request.neededBy,
          paymentMethod: request.paymentMethod,
          recipientName: request.recipientName,
          bankName: request.bankName,
          bankCode: request.bankCode,
          branchName: request.branchName,
          branchCode: request.branchCode,
          paymentInfoNote: request.paymentInfoNote,
          accountingSubjectId: request.accountingSubjectId,
          items: request.items.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            note: item.note,
          })),
        }}
      />
    </div>
  );
}
