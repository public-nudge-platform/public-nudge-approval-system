import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const USERS = [
  { name: "系統管理員", email: "admin@publicnudge.org", password: "admin1234", role: "ADMIN" as const },
  { name: "王理事長", email: "president@publicnudge.org", password: "pres1234", role: "PRESIDENT" as const },
  { name: "陳創辦人", email: "founder@publicnudge.org", password: "founder1234", role: "FOUNDER_AGENT" as const },
  { name: "林財務", email: "finance@publicnudge.org", password: "fin1234", role: "FINANCE" as const },
  { name: "李美玲", email: "alice@publicnudge.org", password: "pass1234", role: "APPLICANT" as const },
  { name: "張大偉", email: "bob@publicnudge.org", password: "pass1234", role: "APPLICANT" as const },
];

const DEFAULT_PROJECTS = [
  "行政",
  "北宜新軌道社會溝通計劃",
  "道路安全設計講座",
  "零碳交通論壇",
  "Project Sidewalk",
  "在宅安寧",
  "博愛路改造計畫",
];

async function main() {
  console.log("🌱 Seeding users...");

  const userMap: Record<string, string> = {};

  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
    userMap[u.email] = user.id;
    console.log(`  ✓ ${u.role.padEnd(14)} ${u.name} (${u.email})`);
  }

  console.log("\n🌱 Seeding projects...");

  const projectMap: Record<string, string> = {};

  for (const name of DEFAULT_PROJECTS) {
    const project = await prisma.project.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    projectMap[name] = project.id;
    console.log(`  ✓ ${name}`);
  }

  const adminProjectId = projectMap["行政"];
  const alice = userMap["alice@publicnudge.org"];
  const bob = userMap["bob@publicnudge.org"];
  const president = userMap["president@publicnudge.org"];

  console.log("\n🌱 Seeding requests...");

  async function seed(data: {
    requestNumber: string;
    type: "REIMBURSEMENT" | "PREPAID";
    status: "DRAFT" | "WITHDRAWN" | "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "PAID" | "CLOSED";
    title: string;
    projectId?: string;
    purpose?: string;
    submitterId: string;
    amount: number;
    items: { description: string; quantity: number; unitPrice: number }[];
    approvalAction?: { action: "APPROVED" | "REJECTED" | "RETURNED"; comment: string; approverId: string };
    paidAt?: Date;
    submittedAt?: Date;
  }) {
    const existing = await prisma.request.findUnique({ where: { requestNumber: data.requestNumber } });
    if (existing) {
      // Update projectId if missing
      if (!existing.projectId && data.projectId) {
        await prisma.request.update({ where: { id: existing.id }, data: { projectId: data.projectId } });
        console.log(`  ↺  ${data.requestNumber} (updated projectId)`);
      } else {
        console.log(`  ⏭  ${data.requestNumber} (skip)`);
      }
      return;
    }

    const created = await prisma.request.create({
      data: {
        requestNumber: data.requestNumber,
        type: data.type,
        status: data.status,
        title: data.title,
        projectId: data.projectId ?? null,
        purpose: data.purpose ?? null,
        amount: data.amount,
        submitterId: data.submitterId,
        submittedAt: data.submittedAt ?? (data.status !== "DRAFT" ? new Date(Date.now() - 3 * 86400_000) : null),
        paidAt: data.paidAt ?? null,
        items: {
          create: data.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: i.quantity * i.unitPrice,
          })),
        },
        ...(data.status !== "DRAFT" && {
          approvalSteps: {
            create: [{
              stepOrder: 1,
              title: "理事長審核",
              ...(data.approvalAction && {
                records: {
                  create: [{
                    approverId: data.approvalAction.approverId,
                    action: data.approvalAction.action,
                    comment: data.approvalAction.comment,
                    actedAt: new Date(Date.now() - 86400_000),
                  }],
                },
              }),
            }],
          },
        }),
      },
    });
    console.log(`  ✓ ${data.requestNumber} ${data.type === "PREPAID" ? "[預付]" : "[一般]"} ${data.title} → ${data.status}`);
    return created;
  }

  await seed({
    requestNumber: "202605001", type: "REIMBURSEMENT", status: "APPROVED",
    title: "辦公用品採購", projectId: adminProjectId, purpose: "辦公室文具及耗材補充",
    submitterId: alice, amount: 3500,
    items: [
      { description: "A4 影印紙 10包", quantity: 10, unitPrice: 150 },
      { description: "原子筆 1打", quantity: 1, unitPrice: 180 },
      { description: "訂書機", quantity: 2, unitPrice: 430 },
    ],
    approvalAction: { action: "APPROVED", comment: "同意，費用合理。", approverId: president },
  });

  await seed({
    requestNumber: "202605002", type: "PREPAID", status: "PAID",
    title: "2026 年度會員大會場地費", projectId: adminProjectId,
    purpose: "租借台北市某場館供大會使用",
    submitterId: alice, amount: 35000,
    items: [{ description: "場地租借費（全天）", quantity: 1, unitPrice: 35000 }],
    approvalAction: { action: "APPROVED", comment: "核准，請財務盡速安排付款。", approverId: president },
    paidAt: new Date(Date.now() - 1 * 86400_000),
  });

  await seed({
    requestNumber: "202605003", type: "REIMBURSEMENT", status: "APPROVED",
    title: "年度大會工作餐費", projectId: adminProjectId,
    purpose: "工作人員午餐便當費用",
    submitterId: alice, amount: 8750,
    items: [
      { description: "工作人員便當 35份", quantity: 35, unitPrice: 200 },
      { description: "飲料（礦泉水）", quantity: 5, unitPrice: 350 },
    ],
    approvalAction: { action: "APPROVED", comment: "特此核准。", approverId: president },
  });

  await seed({
    requestNumber: "202605004", type: "REIMBURSEMENT", status: "PENDING",
    title: "交通費報銷", purpose: "出席外部會議交通費",
    projectId: adminProjectId,
    submitterId: bob, amount: 1200,
    items: [{ description: "高鐵票（台北↔台中 來回）", quantity: 2, unitPrice: 600 }],
  });

  await seed({
    requestNumber: "202605005", type: "PREPAID", status: "PENDING",
    title: "講師費預付", projectId: adminProjectId,
    purpose: "邀請外部講師進行兩場工作坊，費用預付",
    submitterId: bob, amount: 15000,
    items: [
      { description: "講師費（場次一）", quantity: 1, unitPrice: 8000 },
      { description: "講師費（場次二）", quantity: 1, unitPrice: 7000 },
    ],
  });

  await seed({
    requestNumber: "202605006", type: "REIMBURSEMENT", status: "REJECTED",
    title: "個人書籍採購", purpose: "購買個人參考書",
    projectId: adminProjectId,
    submitterId: bob, amount: 1980,
    items: [{ description: "書籍採購", quantity: 3, unitPrice: 660 }],
    approvalAction: { action: "REJECTED", comment: "個人用書籍不在核銷範圍內，請重新評估。", approverId: president },
  });

  await seed({
    requestNumber: "202605007", type: "REIMBURSEMENT", status: "RETURNED",
    title: "網站維護費用", projectId: adminProjectId,
    purpose: "年度網站主機費及網域費用",
    submitterId: alice, amount: 5000,
    items: [
      { description: "主機費用（年繳）", quantity: 1, unitPrice: 3600 },
      { description: "網域費用", quantity: 1, unitPrice: 1400 },
    ],
    approvalAction: { action: "RETURNED", comment: "請補附發票正本後重新送件。", approverId: president },
  });

  await seed({
    requestNumber: "202605008", type: "REIMBURSEMENT", status: "DRAFT",
    title: "文具費用補充", purpose: "行政部門耗材補充",
    projectId: adminProjectId,
    submitterId: bob, amount: 450,
    items: [{ description: "各式文具", quantity: 1, unitPrice: 450 }],
  });

  // Also update any existing requests with old request numbers to assign the admin project
  await prisma.request.updateMany({
    where: { projectId: null },
    data: { projectId: adminProjectId },
  });
  console.log("  ↺  assigned admin project to all unlinked requests");

  console.log("\n✅ Seed complete!");
  console.log("\n測試帳號：");
  USERS.forEach((u) => console.log(`  ${u.role.padEnd(14)} ${u.email.padEnd(30)} 密碼: ${u.password}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
