export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { PROJECT_MANAGE_ROLES, PROJECT_VIEW_ROLES } from "@/lib/constants";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const session = await auth();
  const role = session!.user.role as UserRole;

  if (!PROJECT_VIEW_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { requests: true } },
      requests: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          requestNumber: true,
          type: true,
          title: true,
          amount: true,
          status: true,
          requestDate: true,
          paidAt: true,
          submitter: { select: { name: true } },
          accountingSubject: { select: { code: true, name: true } },
          finalAccountingSubject: { select: { code: true, name: true } },
        },
      },
    },
  });

  const canManage = PROJECT_MANAGE_ROLES.includes(role);

  return <ProjectsClient projects={projects} canManage={canManage} />;
}
