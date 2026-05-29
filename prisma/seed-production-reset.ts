/**
 * Production business-data reset + demo seed
 *
 * Safety requirements:
 *   ENABLE_DEMO_RESET=true   must be set explicitly
 *
 * What this script does:
 *   1. Verifies ENABLE_DEMO_RESET=true
 *   2. Reads existing users (preserves them — does NOT delete users)
 *   3. Clears all business data in FK-safe order
 *   4. Rebuilds complete demo data for all roles
 */

import "dotenv/config";
import * as path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ── Safety guard ───────────────────────────────────────────────────────────────
if (process.env.ENABLE_DEMO_RESET !== "true") {
  console.error(
    "\n❌  BLOCKED: Set ENABLE_DEMO_RESET=true to allow this operation.\n"
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Helpers ────────────────────────────────────────────────────────────────────
const now = new Date();
const ago = (days: number, hours = 0) =>
  new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000);

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const dbUrl =
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "(unset)";
  console.log("\n=================================================");
  console.log("🔑 DATABASE_URL :", dbUrl);
  console.log("=================================================\n");

  // ── Step 1: Verify existing users ─────────────────────────────────────────
  console.log("👤 Checking existing users...");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  for (const u of users) {
    console.log(`   ${u.role.padEnd(14)} ${u.name.padEnd(8)} ${u.email}`);
  }

  const admin = users.find((u) => u.role === "ADMIN");
  const president = users.find((u) => u.role === "PRESIDENT");
  const founderAgent = users.find((u) => u.role === "FOUNDER_AGENT");
  const finance = users.find((u) => u.role === "FINANCE");
  const applicants = users.filter((u) => u.role === "APPLICANT");

  const missing: string[] = [];
  if (!admin) missing.push("ADMIN");
  if (!president) missing.push("PRESIDENT");
  if (!founderAgent) missing.push("FOUNDER_AGENT");
  if (!finance) missing.push("FINANCE");
  if (applicants.length === 0) missing.push("APPLICANT");

  if (missing.length > 0) {
    console.error(`\n❌  Missing required roles: ${missing.join(", ")}`);
    console.error("    Please create the required user accounts first.\n");
    process.exit(1);
  }

  const applicant1 = applicants[0];
  const applicant2 = applicants[1] ?? applicants[0];

  const adminId = admin!.id;
  const presidentId = president!.id;
  const founderId = founderAgent!.id;
  const financeId = finance!.id;
  const applicantId = applicant1.id;
  const applicant2Id = applicant2.id;

  const adminName = admin!.name;
  const presidentName = president!.name;
  const founderName = founderAgent!.name;
  const financeName = finance!.name;
  const applicantName = applicant1.name;

  // ── Step 2: Clear business data (FK-safe order, preserving users) ──────────
  console.log("\n🗑️  Clearing business data (users preserved)...");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.accountTransaction.deleteMany();
  // Cascade from requests: paymentAdjustments, approvalRecords, approvalSteps,
  //                        attachments, requestItems
  await prisma.request.deleteMany();
  await prisma.paymentRecipient.deleteMany();
  await prisma.accountingSubject.deleteMany();
  await prisma.financialAccount.deleteMany();
  await prisma.project.deleteMany();
  console.log("   ✓ All business data cleared\n");

  // ── Step 3: Projects ───────────────────────────────────────────────────────
  console.log("📁 Creating projects...");
  const projectDefs = [
    { name: "行政", status: "IN_PROGRESS" as const },
    { name: "北宜新軌道社會溝通計劃", status: "IN_PROGRESS" as const },
    { name: "道路安全設計講座", status: "IN_PROGRESS" as const },
    { name: "零碳交通論壇", status: "CLOSED" as const },
    { name: "Project Sidewalk", status: "IN_PROGRESS" as const },
    { name: "在宅安寧", status: "NOT_STARTED" as const },
    { name: "博愛路改造計畫", status: "IN_PROGRESS" as const },
  ];
  const pm: Record<string, string> = {};
  for (const p of projectDefs) {
    const r = await prisma.project.create({ data: p });
    pm[p.name] = r.id;
    console.log(`   ✓ ${p.name} [${p.status}]`);
  }

  // ── Step 4: Payment recipients ─────────────────────────────────────────────
  console.log("\n💳 Creating payment recipients...");
  const recipients = [
    "方瀚賢",
    "王儷潔",
    "鍾慧諭",
    "集思北科大",
    "集思交通部",
    "張老師",
    "林小姐",
    "交通安全顧問有限公司",
  ];
  for (const name of recipients) {
    await prisma.paymentRecipient.create({ data: { name } });
    console.log(`   ✓ ${name}`);
  }

  // ── Step 5: Accounting subjects (from XLSX) ────────────────────────────────
  console.log("\n📊 Importing accounting subjects from XLSX...");
  const xlsxPath = path.resolve(__dirname, "../data/會計科目表(公民幫推).xlsx");
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
  });
  let subjectUpserted = 0;
  const subjectMap: Record<string, string> = {};
  for (const row of rows.slice(2)) {
    const code = row[0];
    if (!code || typeof code !== "number") continue;
    const isActive = row[1] === "Y";
    const name = typeof row[2] === "string" ? row[2].trim() : null;
    const direction =
      typeof row[3] === "string" ? row[3].trim() : "";
    if (!name) continue;
    const r = await prisma.accountingSubject.upsert({
      where: { code: String(code) },
      update: { name, direction, isActive },
      create: { code: String(code), name, direction, isActive },
    });
    subjectMap[String(code)] = r.id;
    subjectUpserted++;
  }
  console.log(`   ✓ ${subjectUpserted} subjects upserted`);

  // Convenience aliases
  const sId = (code: string) => subjectMap[code] ?? null;
  // Expense subjects
  const subj文具 = sId("5812"); // 專案支出-文具用品
  const subj場地費 = sId("5804"); // 專案支出-場地費
  const subj講師費 = sId("5805"); // 專案支出-講師費
  const subj餐費 = sId("5806"); // 專案支出-餐費
  const subj印刷費 = sId("5807"); // 專案支出-印刷費
  const subj交通費 = sId("5803"); // 專案支出-交通費
  const subj雜費 = sId("5407"); // 雜項支出
  const subj辦公費 = sId("5201"); // 文具、書報、雜誌費
  // Income subjects
  const subj補助款 = sId("4802"); // 專案收入-補助款
  const subj捐款 = sId("4400"); // 會員捐款
  const subj活動收入 = sId("4800"); // 專案收入

  // ── Step 6: Financial accounts ─────────────────────────────────────────────
  console.log("\n🏦 Creating financial accounts...");
  const faPost = await prisma.financialAccount.create({
    data: {
      name: "郵局帳戶",
      type: "POST_OFFICE",
      accountLastFive: "12345",
      initialBalance: 1_000_000,
      isActive: true,
    },
  });
  const faBank = await prisma.financialAccount.create({
    data: {
      name: "兆豐銀行帳戶",
      type: "BANK",
      bankName: "兆豐銀行",
      accountLastFive: "67890",
      initialBalance: 500_000,
      isActive: true,
    },
  });
  console.log("   ✓ 郵局帳戶 (初始餘額 1,000,000)");
  console.log("   ✓ 兆豐銀行帳戶 (初始餘額 500,000)");

  // ── Step 7: Account transactions ─────────────────────────────────────────
  console.log("\n💰 Creating account transactions...");
  const tx1 = await prisma.accountTransaction.create({
    data: {
      accountId: faPost.id,
      type: "INCOME",
      amount: 300_000,
      transactionDate: ago(10),
      summary: "政府補助款入帳",
      projectId: pm["北宜新軌道社會溝通計劃"],
      accountingSubjectId: subj補助款,
      createdById: financeId,
    },
  });
  const tx2 = await prisma.accountTransaction.create({
    data: {
      accountId: faBank.id,
      type: "INCOME",
      amount: 100_000,
      transactionDate: ago(8),
      summary: "活動收入入帳",
      projectId: pm["零碳交通論壇"],
      accountingSubjectId: subj活動收入,
      createdById: financeId,
    },
  });
  const tx3 = await prisma.accountTransaction.create({
    data: {
      accountId: faPost.id,
      type: "INCOME",
      amount: 50_000,
      transactionDate: ago(5),
      summary: "捐款收入",
      projectId: pm["行政"],
      accountingSubjectId: subj捐款,
      createdById: financeId,
    },
  });
  const tx4 = await prisma.accountTransaction.create({
    data: {
      accountId: faBank.id,
      type: "EXPENSE",
      amount: 15_000,
      transactionDate: ago(3),
      summary: "講師費付款",
      projectId: pm["道路安全設計講座"],
      accountingSubjectId: subj講師費,
      createdById: financeId,
    },
  });
  const tx5 = await prisma.accountTransaction.create({
    data: {
      accountId: faPost.id,
      type: "EXPENSE",
      amount: 3_000,
      transactionDate: ago(2),
      summary: "辦公用品採購",
      projectId: pm["行政"],
      accountingSubjectId: subj辦公費,
      createdById: financeId,
    },
  });
  console.log("   ✓ 郵局 +300,000 政府補助款");
  console.log("   ✓ 兆豐 +100,000 活動收入");
  console.log("   ✓ 郵局 +50,000  捐款收入");
  console.log("   ✓ 兆豐 -15,000  講師費");
  console.log("   ✓ 郵局 -3,000   辦公用品");

  // ── Step 8: Requests (12 scenarios) ───────────────────────────────────────
  console.log("\n📋 Creating demo requests...\n");

  // ─────────────────────────────────────────────────────────────────────────
  // R1 · DRAFT · 一般請款
  // ─────────────────────────────────────────────────────────────────────────
  const r1 = await prisma.request.create({
    data: {
      requestNumber: "2026D001",
      type: "REIMBURSEMENT",
      status: "DRAFT",
      title: "辦公文具採購（草稿）",
      projectId: pm["行政"],
      purpose: "補充辦公室日常文具耗材",
      amount: 1_250,
      submitterId: applicantId,
      accountingSubjectId: subj文具,
      finalAccountingSubjectId: subj文具,
      createdAt: ago(1),
      items: {
        create: [
          { description: "A4 影印紙 5 包", quantity: 5, unitPrice: 150, amount: 750 },
          { description: "原子筆 2 打", quantity: 2, unitPrice: 250, amount: 500 },
        ],
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: applicantId, userName: applicantName,
      action: "REQUEST_CREATED", entityType: "Request", entityId: r1.id,
      description: `新增請款單 ${r1.requestNumber}「${r1.title}」`,
      createdAt: ago(1),
    },
  });
  console.log("   ✓ 2026D001  [一般]  草稿 DRAFT");

  // ─────────────────────────────────────────────────────────────────────────
  // R2 · PENDING · 一般請款（待理事長簽核）
  // ─────────────────────────────────────────────────────────────────────────
  const r2 = await prisma.request.create({
    data: {
      requestNumber: "2026D002",
      type: "REIMBURSEMENT",
      status: "PENDING",
      title: "道安講座場地費",
      projectId: pm["道路安全設計講座"],
      purpose: "舉辦道路安全設計工作坊場地租借費用",
      amount: 12_000,
      submitterId: applicantId,
      accountingSubjectId: subj場地費,
      submittedAt: ago(2),
      createdAt: ago(3),
      items: {
        create: [
          { description: "場地租借半日", quantity: 1, unitPrice: 8_000, amount: 8_000 },
          { description: "設備使用費", quantity: 1, unitPrice: 4_000, amount: 4_000 },
        ],
      },
      approvalSteps: {
        create: [{ stepOrder: 1, title: "理事長審核" }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_CREATED", entityType: "Request", entityId: r2.id,
        description: `新增請款單 ${r2.requestNumber}`, createdAt: ago(3),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r2.id,
        description: `送出請款單 ${r2.requestNumber}`, createdAt: ago(2),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: presidentId,
        title: "新的請款單待審核",
        message: `${applicantName} 提交了「${r2.title}」NT$12,000，請審核。`,
        type: "REQUEST_SUBMITTED",
        relatedRequestId: r2.id,
        createdAt: ago(2),
      },
      {
        userId: founderId,
        title: "新的請款單待審核",
        message: `${applicantName} 提交了「${r2.title}」NT$12,000，請審核。`,
        type: "REQUEST_SUBMITTED",
        relatedRequestId: r2.id,
        createdAt: ago(2),
      },
    ],
  });
  console.log("   ✓ 2026D002  [一般]  待簽核 PENDING");

  // ─────────────────────────────────────────────────────────────────────────
  // R3 · WITHDRAWN · 一般請款
  // ─────────────────────────────────────────────────────────────────────────
  const r3 = await prisma.request.create({
    data: {
      requestNumber: "2026D003",
      type: "REIMBURSEMENT",
      status: "WITHDRAWN",
      title: "零碳論壇講師邀請費（已抽單）",
      projectId: pm["零碳交通論壇"],
      purpose: "邀請外部專家出席零碳交通論壇",
      amount: 8_000,
      submitterId: applicantId,
      accountingSubjectId: subj講師費,
      submittedAt: ago(6),
      createdAt: ago(7),
      items: {
        create: [{ description: "講師費", quantity: 1, unitPrice: 8_000, amount: 8_000 }],
      },
      approvalSteps: {
        create: [{ stepOrder: 1, title: "理事長審核" }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_CREATED", entityType: "Request", entityId: r3.id,
        description: `新增請款單 ${r3.requestNumber}`, createdAt: ago(7),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r3.id,
        description: `送出請款單 ${r3.requestNumber}`, createdAt: ago(6),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_WITHDRAWN", entityType: "Request", entityId: r3.id,
        description: `抽回請款單 ${r3.requestNumber}（金額有誤，待修正）`,
        createdAt: ago(5),
      },
    ],
  });
  console.log("   ✓ 2026D003  [一般]  已抽單 WITHDRAWN");

  // ─────────────────────────────────────────────────────────────────────────
  // R4 · RETURNED · 理事長退回
  // ─────────────────────────────────────────────────────────────────────────
  const r4 = await prisma.request.create({
    data: {
      requestNumber: "2026D004",
      type: "REIMBURSEMENT",
      status: "RETURNED",
      title: "北宜新軌道宣傳印刷費（退回補件）",
      projectId: pm["北宜新軌道社會溝通計劃"],
      purpose: "製作北宜新軌道社會溝通計劃宣傳手冊",
      amount: 9_600,
      submitterId: applicantId,
      accountingSubjectId: subj印刷費,
      submittedAt: ago(8),
      createdAt: ago(9),
      items: {
        create: [
          { description: "A5 摺頁 1000 份", quantity: 1_000, unitPrice: 8, amount: 8_000 },
          { description: "設計費", quantity: 1, unitPrice: 1_600, amount: 1_600 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action: "RETURNED",
              comment: "請補附印刷廠商報價單及發票正本後重新送件。",
              actedAt: ago(7),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_CREATED", entityType: "Request", entityId: r4.id,
        description: `新增請款單 ${r4.requestNumber}`, createdAt: ago(9),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r4.id,
        description: `送出請款單 ${r4.requestNumber}`, createdAt: ago(8),
      },
      {
        userId: presidentId, userName: presidentName,
        action: "REQUEST_RETURNED", entityType: "Request", entityId: r4.id,
        description: `退回請款單 ${r4.requestNumber}：請補附印刷廠商報價單及發票正本`,
        createdAt: ago(7),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title: "請款單已退回",
      message: `您的請款單「${r4.title}」已被退回，請補件後重新送出。`,
      type: "REQUEST_RETURNED",
      relatedRequestId: r4.id,
      createdAt: ago(7),
    },
  });
  console.log("   ✓ 2026D004  [一般]  理事長退回 RETURNED");

  // ─────────────────────────────────────────────────────────────────────────
  // R5 · APPROVED · 行政出納退回補正後重新核准（待付款）
  //     Audit trail: SUBMITTED → APPROVED → RETURNED(finance) → SUBMITTED → APPROVED
  // ─────────────────────────────────────────────────────────────────────────
  const r5 = await prisma.request.create({
    data: {
      requestNumber: "2026D005",
      type: "REIMBURSEMENT",
      status: "APPROVED",
      title: "博愛路改造說明會費用（補正重送）",
      projectId: pm["博愛路改造計畫"],
      purpose: "舉辦博愛路改造計畫社區說明會場地及餐點費用",
      amount: 7_200,
      submitterId: applicantId,
      accountingSubjectId: subj場地費,
      finalAccountingSubjectId: subj場地費,
      submittedAt: ago(12),
      createdAt: ago(14),
      paymentRecipientName: "王儷潔",
      bankName: "合作金庫",
      bankCode: "006",
      branchName: "中山分行",
      branchCode: "0047",
      recipientName: "王儷潔",
      bankLastFive: "78901",
      items: {
        create: [
          { description: "場地租借費", quantity: 1, unitPrice: 4_500, amount: 4_500 },
          { description: "餐點費用", quantity: 1, unitPrice: 2_700, amount: 2_700 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action: "APPROVED",
              comment: "核准，費用合理，請財務儘速安排付款。",
              actedAt: ago(4),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_CREATED", entityType: "Request", entityId: r5.id,
        description: `新增請款單 ${r5.requestNumber}`, createdAt: ago(14),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r5.id,
        description: `送出請款單 ${r5.requestNumber}（第一次）`, createdAt: ago(12),
      },
      {
        userId: presidentId, userName: presidentName,
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r5.id,
        description: `核准請款單 ${r5.requestNumber}（第一次）`, createdAt: ago(11),
      },
      {
        userId: financeId, userName: financeName,
        action: "REQUEST_RETURNED", entityType: "Request", entityId: r5.id,
        description: `行政出納退回補正 ${r5.requestNumber}：收款帳號資訊不完整，請補充分行代號`,
        createdAt: ago(9),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r5.id,
        description: `補正重送請款單 ${r5.requestNumber}（已補全帳號資訊）`, createdAt: ago(6),
      },
      {
        userId: presidentId, userName: presidentName,
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r5.id,
        description: `核准請款單 ${r5.requestNumber}（第二次）`, createdAt: ago(4),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: applicantId,
        title: "請款單退回補正",
        message: `您的請款單「${r5.title}」已被行政出納退回補正，請修改後重新送出。`,
        type: "REQUEST_RETURNED",
        relatedRequestId: r5.id,
        createdAt: ago(9),
        isRead: true,
      },
      {
        userId: applicantId,
        title: "請款單已核准",
        message: `您的請款單「${r5.title}」已核准，財務將儘速安排付款。`,
        type: "REQUEST_APPROVED",
        relatedRequestId: r5.id,
        createdAt: ago(4),
      },
      {
        userId: financeId,
        title: "有新的付款待處理",
        message: `請款單「${r5.title}」NT$7,200 已核准（補正後），請安排付款。`,
        type: "REQUEST_APPROVED",
        relatedRequestId: r5.id,
        createdAt: ago(4),
      },
    ],
  });
  console.log("   ✓ 2026D005  [一般]  行政出納退回補正→重新核准 APPROVED");

  // ─────────────────────────────────────────────────────────────────────────
  // R6 · APPROVED · 創會理事長核准（待付款）
  // ─────────────────────────────────────────────────────────────────────────
  const r6 = await prisma.request.create({
    data: {
      requestNumber: "2026D006",
      type: "REIMBURSEMENT",
      status: "APPROVED",
      title: "Project Sidewalk 工作坊餐費",
      projectId: pm["Project Sidewalk"],
      purpose: "Project Sidewalk 工作坊工作人員及與會者餐費",
      amount: 6_000,
      submitterId: applicantId,
      accountingSubjectId: subj餐費,
      finalAccountingSubjectId: subj餐費,
      submittedAt: ago(5),
      createdAt: ago(6),
      paymentRecipientName: "方瀚賢",
      bankName: "台灣銀行",
      bankCode: "004",
      branchName: "信義分行",
      branchCode: "0058",
      recipientName: "方瀚賢",
      bankLastFive: "12345",
      items: {
        create: [
          { description: "午餐便當 20 份", quantity: 20, unitPrice: 200, amount: 4_000 },
          { description: "飲料（礦泉水）", quantity: 4, unitPrice: 500, amount: 2_000 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "創會理事長審核",
          records: {
            create: [{
              approverId: founderId,
              action: "APPROVED",
              comment: "核准，費用合理，請財務儘速安排付款。",
              actedAt: ago(3),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: applicantName,
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r6.id,
        description: `送出請款單 ${r6.requestNumber}`, createdAt: ago(5),
      },
      {
        userId: founderId, userName: founderName,
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r6.id,
        description: `創會理事長核准請款單 ${r6.requestNumber}`, createdAt: ago(3),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: presidentId,
        title: "創會理事長已核准請款",
        message: `${founderName} 核准了「${r6.title}」NT$6,000。`,
        type: "REQUEST_APPROVED",
        relatedRequestId: r6.id,
        createdAt: ago(3),
      },
      {
        userId: financeId,
        title: "有新的付款待處理",
        message: `請款單「${r6.title}」NT$6,000 已核准，請安排付款。`,
        type: "REQUEST_APPROVED",
        relatedRequestId: r6.id,
        createdAt: ago(3),
      },
      {
        userId: applicantId,
        title: "請款單已核准",
        message: `您的請款單「${r6.title}」已核准，財務將儘速安排付款。`,
        type: "REQUEST_APPROVED",
        relatedRequestId: r6.id,
        createdAt: ago(3),
      },
    ],
  });
  console.log("   ✓ 2026D006  [一般]  創會理事長核准 APPROVED (待付款)");

  // ─────────────────────────────────────────────────────────────────────────
  // R7 · PAID · 一般請款
  // ─────────────────────────────────────────────────────────────────────────
  const r7 = await prisma.request.create({
    data: {
      requestNumber: "2026D007",
      type: "REIMBURSEMENT",
      status: "PAID",
      title: "在宅安寧工作坊場地費",
      projectId: pm["在宅安寧"],
      purpose: "在宅安寧工作坊場地租借費用",
      amount: 4_800,
      submitterId: applicantId,
      accountingSubjectId: subj場地費,
      finalAccountingSubjectId: subj場地費,
      submittedAt: ago(18),
      createdAt: ago(19),
      paidAt: ago(14),
      paymentMethod: "BANK_TRANSFER",
      paymentNote: "已匯款至申請人帳戶，交易序號 TXN202604150001",
      paidBy: financeName,
      paymentRecipientName: "鍾慧諭",
      bankName: "第一銀行",
      bankCode: "007",
      branchName: "南京分行",
      branchCode: "0041",
      recipientName: "鍾慧諭",
      bankLastFive: "56789",
      items: {
        create: [
          { description: "場地租借費", quantity: 1, unitPrice: 3_000, amount: 3_000 },
          { description: "清潔費", quantity: 1, unitPrice: 1_800, amount: 1_800 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action: "APPROVED",
              comment: "核准。",
              actedAt: ago(17),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: presidentId, userName: presidentName,
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r7.id,
        description: `核准請款單 ${r7.requestNumber}`, createdAt: ago(17),
      },
      {
        userId: financeId, userName: financeName,
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r7.id,
        description: `標記已付款 ${r7.requestNumber}，銀行轉帳 TXN202604150001`,
        createdAt: ago(14),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: applicantId,
        title: "款項已付款",
        message: `您的請款單「${r7.title}」款項 NT$4,800 已完成匯款。`,
        type: "PAYMENT_COMPLETED",
        relatedRequestId: r7.id,
        createdAt: ago(14),
        isRead: true,
      },
      {
        userId: presidentId,
        title: "行政出納已完成付款",
        message: `${financeName} 已完成「${r7.title}」NT$4,800 付款作業。`,
        type: "PAYMENT_COMPLETED",
        relatedRequestId: r7.id,
        createdAt: ago(14),
      },
      {
        userId: founderId,
        title: "行政出納已完成付款",
        message: `${financeName} 已完成「${r7.title}」NT$4,800 付款作業。`,
        type: "PAYMENT_COMPLETED",
        relatedRequestId: r7.id,
        createdAt: ago(14),
      },
    ],
  });
  await prisma.attachment.create({
    data: {
      requestId: r7.id,
      filename: "payment_slip_2026D007.pdf",
      url: "/demo/attachments/payment_slip_2026D007.pdf",
      mimeType: "application/pdf",
      size: 18_540,
      isPayment: true,
    },
  });
  console.log("   ✓ 2026D007  [一般]  已付款 PAID");

  // ─────────────────────────────────────────────────────────────────────────
  // R8 · REJECTED · 一般請款
  // ─────────────────────────────────────────────────────────────────────────
  const r8 = await prisma.request.create({
    data: {
      requestNumber: "2026D008",
      type: "REIMBURSEMENT",
      status: "REJECTED",
      title: "在宅安寧專案書籍採購（已拒絕）",
      projectId: pm["在宅安寧"],
      purpose: "採購在宅安寧相關參考書籍",
      amount: 3_960,
      submitterId: applicantId,
      accountingSubjectId: subj辦公費,
      submittedAt: ago(20),
      createdAt: ago(21),
      items: {
        create: [
          { description: "專業書籍", quantity: 3, unitPrice: 1_320, amount: 3_960 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "創會理事長審核",
          records: {
            create: [{
              approverId: founderId,
              action: "REJECTED",
              comment: "個人用途書籍不在協會核銷範圍，請重新評估需求後提出。",
              actedAt: ago(19),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: founderId, userName: founderName,
      action: "REQUEST_REJECTED", entityType: "Request", entityId: r8.id,
      description: `拒絕請款單 ${r8.requestNumber}：個人用途書籍不在核銷範圍`,
      createdAt: ago(19),
    },
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title: "請款單已拒絕",
      message: `您的請款單「${r8.title}」已被拒絕。原因：個人用途書籍不在協會核銷範圍。`,
      type: "REQUEST_REJECTED",
      relatedRequestId: r8.id,
      createdAt: ago(19),
      isRead: true,
    },
  });
  console.log("   ✓ 2026D008  [一般]  已拒絕 REJECTED");

  // ─────────────────────────────────────────────────────────────────────────
  // R9 · PENDING_SETTLEMENT · 預付請款（已付款，待沖銷）
  // ─────────────────────────────────────────────────────────────────────────
  const r9 = await prisma.request.create({
    data: {
      requestNumber: "2026D009",
      type: "PREPAID",
      status: "PENDING_SETTLEMENT",
      title: "行政-年度場館預付款（待沖銷）",
      projectId: pm["行政"],
      purpose: "預付 2026 年度會員大會場館租借費用",
      amount: 50_000,
      submitterId: applicantId,
      accountingSubjectId: subj場地費,
      submittedAt: ago(25),
      createdAt: ago(26),
      paidAt: ago(18),
      paymentMethod: "BANK_TRANSFER",
      paymentNote: "已匯款至集思北科大，請款人需於活動後 30 日內完成沖銷。",
      paidBy: financeName,
      paymentRecipientName: "集思北科大",
      bankLastFive: "11223",
      items: {
        create: [
          { description: "場地租借費（全日）", quantity: 1, unitPrice: 45_000, amount: 45_000 },
          { description: "清潔費", quantity: 1, unitPrice: 5_000, amount: 5_000 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action: "APPROVED",
              comment: "核准，請財務安排預付款。",
              actedAt: ago(24),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: presidentId, userName: presidentName,
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r9.id,
        description: `核准預付請款單 ${r9.requestNumber}`, createdAt: ago(24),
      },
      {
        userId: financeId, userName: financeName,
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r9.id,
        description: `預付款已付款 ${r9.requestNumber}，等待申請人沖銷`, createdAt: ago(18),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title: "預付款已付款，請完成沖銷",
      message: `「${r9.title}」預付款 NT$50,000 已付款，請於活動後 30 日內上傳實際費用憑證完成沖銷。`,
      type: "REIMBURSEMENT_REQUIRED",
      relatedRequestId: r9.id,
      createdAt: ago(18),
    },
  });
  console.log("   ✓ 2026D009  [預付]  預付待沖銷 PENDING_SETTLEMENT");

  // ─────────────────────────────────────────────────────────────────────────
  // R10 · OFFSET_SUBMITTED · 預付請款（沖銷待確認）
  // ─────────────────────────────────────────────────────────────────────────
  const r10 = await prisma.request.create({
    data: {
      requestNumber: "2026D010",
      type: "PREPAID",
      status: "OFFSET_SUBMITTED",
      title: "北宜論壇講師費預付（沖銷待確認）",
      projectId: pm["北宜新軌道社會溝通計劃"],
      purpose: "北宜新軌道社會溝通計劃論壇系列講師費預付",
      amount: 30_000,
      submitterId: applicantId,
      accountingSubjectId: subj講師費,
      finalAccountingSubjectId: subj講師費,
      submittedAt: ago(40),
      createdAt: ago(41),
      paidAt: ago(35),
      paymentMethod: "BANK_TRANSFER",
      paidBy: financeName,
      paymentRecipientName: "鍾慧諭",
      bankLastFive: "55678",
      actualAmount: 28_500,
      reimbursementNote: "實際場次減少一場，費用較預付少 NT$1,500，已附相關憑證。",
      reimbursementSubmittedAt: ago(5),
      items: {
        create: [
          { description: "講師費（場次一）", quantity: 1, unitPrice: 12_000, amount: 12_000 },
          { description: "講師費（場次二）", quantity: 1, unitPrice: 10_000, amount: 10_000 },
          { description: "講師費（場次三）", quantity: 1, unitPrice: 8_000, amount: 8_000 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action: "APPROVED",
              comment: "核准，請安排付款。",
              actedAt: ago(39),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: financeId, userName: financeName,
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r10.id,
        description: `預付款已付款 ${r10.requestNumber}`, createdAt: ago(35),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "SETTLEMENT_SUBMITTED", entityType: "Request", entityId: r10.id,
        description: `送出沖銷 ${r10.requestNumber}，實際金額 NT$28,500`, createdAt: ago(5),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: financeId,
        title: "沖銷資料待確認",
        message: `「${r10.title}」已提交沖銷資料，實際金額 NT$28,500，請確認。`,
        type: "SETTLEMENT_SUBMITTED",
        relatedRequestId: r10.id,
        createdAt: ago(5),
      },
      {
        userId: presidentId,
        title: "有沖銷待確認",
        message: `${applicantName} 已提交「${r10.title}」沖銷，實際 NT$28,500，請行政出納確認。`,
        type: "SETTLEMENT_SUBMITTED",
        relatedRequestId: r10.id,
        createdAt: ago(5),
      },
      {
        userId: founderId,
        title: "有沖銷待確認",
        message: `${applicantName} 已提交「${r10.title}」沖銷，實際 NT$28,500，請行政出納確認。`,
        type: "SETTLEMENT_SUBMITTED",
        relatedRequestId: r10.id,
        createdAt: ago(5),
      },
    ],
  });
  await prisma.attachment.create({
    data: {
      requestId: r10.id,
      filename: "settlement_invoices_2026D010.zip",
      url: "/demo/attachments/settlement_invoices_2026D010.zip",
      mimeType: "application/zip",
      size: 312_400,
      isSettlement: true,
    },
  });
  console.log("   ✓ 2026D010  [預付]  沖銷待確認 OFFSET_SUBMITTED");

  // ─────────────────────────────────────────────────────────────────────────
  // R11 · OFFSET_RETURNED · 預付請款（沖銷退回補件）
  // ─────────────────────────────────────────────────────────────────────────
  const r11 = await prisma.request.create({
    data: {
      requestNumber: "2026D011",
      type: "PREPAID",
      status: "OFFSET_RETURNED",
      title: "道安講座場地費預付（沖銷退回）",
      projectId: pm["道路安全設計講座"],
      purpose: "道路安全設計講座系列活動場地費預付",
      amount: 20_000,
      submitterId: applicantId,
      accountingSubjectId: subj場地費,
      submittedAt: ago(50),
      createdAt: ago(51),
      paidAt: ago(45),
      paymentMethod: "BANK_TRANSFER",
      paidBy: financeName,
      paymentRecipientName: "集思交通部",
      bankLastFive: "99001",
      actualAmount: 19_500,
      reimbursementNote: "已附三場活動發票，其中一場費用減少 NT$500。",
      reimbursementSubmittedAt: ago(12),
      offsetReviewedAt: ago(10),
      offsetReviewedBy: financeName,
      offsetReviewNote: "發票日期與活動日期不符，請補附正確日期發票或說明。",
      items: {
        create: [
          { description: "道安講座場地（場次一）", quantity: 1, unitPrice: 8_000, amount: 8_000 },
          { description: "道安講座場地（場次二）", quantity: 1, unitPrice: 7_000, amount: 7_000 },
          { description: "道安講座場地（場次三）", quantity: 1, unitPrice: 5_000, amount: 5_000 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "創會理事長審核",
          records: {
            create: [{
              approverId: founderId,
              action: "APPROVED",
              comment: "核准，請安排付款。",
              actedAt: ago(49),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: applicantName,
        action: "SETTLEMENT_SUBMITTED", entityType: "Request", entityId: r11.id,
        description: `送出沖銷 ${r11.requestNumber}，實際金額 NT$19,500`, createdAt: ago(12),
      },
      {
        userId: financeId, userName: financeName,
        action: "SETTLEMENT_RETURNED", entityType: "Request", entityId: r11.id,
        description: `退回沖銷 ${r11.requestNumber}：發票日期不符，需補件`, createdAt: ago(10),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title: "沖銷資料退回補件",
      message: `「${r11.title}」沖銷資料已退回，請補附正確日期發票後重新送出。`,
      type: "SETTLEMENT_RETURNED",
      relatedRequestId: r11.id,
      createdAt: ago(10),
    },
  });
  console.log("   ✓ 2026D011  [預付]  沖銷退回補件 OFFSET_RETURNED");

  // ─────────────────────────────────────────────────────────────────────────
  // R12 · CLOSED · 預付請款（已結案）
  // ─────────────────────────────────────────────────────────────────────────
  const r12 = await prisma.request.create({
    data: {
      requestNumber: "2026D012",
      type: "PREPAID",
      status: "CLOSED",
      title: "零碳論壇宣傳費預付（已結案）",
      projectId: pm["零碳交通論壇"],
      purpose: "零碳交通論壇宣傳及印刷費用預付",
      amount: 15_000,
      submitterId: applicantId,
      accountingSubjectId: subj印刷費,
      finalAccountingSubjectId: subj印刷費,
      submittedAt: ago(70),
      createdAt: ago(71),
      paidAt: ago(65),
      paymentMethod: "BANK_TRANSFER",
      paidBy: financeName,
      paymentRecipientName: "方瀚賢",
      bankLastFive: "34567",
      actualAmount: 14_800,
      reimbursementNote: "實際費用 NT$14,800，較預付少 NT$200，已退還差額。",
      reimbursementSubmittedAt: ago(40),
      offsetReviewedAt: ago(35),
      offsetReviewedBy: financeName,
      offsetReviewNote: "核銷完成，差額 NT$200 已由申請人退還。",
      items: {
        create: [
          { description: "海報設計及印刷", quantity: 1, unitPrice: 8_000, amount: 8_000 },
          { description: "社群廣告費用", quantity: 1, unitPrice: 5_000, amount: 5_000 },
          { description: "活動手冊印刷", quantity: 1, unitPrice: 2_000, amount: 2_000 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action: "APPROVED",
              comment: "核准，請財務安排預付。",
              actedAt: ago(69),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: presidentId, userName: presidentName,
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r12.id,
        description: `核准預付請款單 ${r12.requestNumber}`, createdAt: ago(69),
      },
      {
        userId: financeId, userName: financeName,
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r12.id,
        description: `預付款已付款 ${r12.requestNumber}`, createdAt: ago(65),
      },
      {
        userId: applicantId, userName: applicantName,
        action: "SETTLEMENT_SUBMITTED", entityType: "Request", entityId: r12.id,
        description: `送出沖銷 ${r12.requestNumber}，實際金額 NT$14,800`, createdAt: ago(40),
      },
      {
        userId: financeId, userName: financeName,
        action: "SETTLEMENT_APPROVED", entityType: "Request", entityId: r12.id,
        description: `沖銷完成 ${r12.requestNumber}，已結案`, createdAt: ago(35),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: applicantId,
        title: "預付請款已結案",
        message: `「${r12.title}」沖銷已完成確認，案件已結案。`,
        type: "SETTLEMENT_APPROVED",
        relatedRequestId: r12.id,
        createdAt: ago(35),
        isRead: true,
      },
    ],
  });
  await prisma.attachment.createMany({
    data: [
      {
        requestId: r12.id,
        filename: "payment_proof_2026D012.pdf",
        url: "/demo/attachments/payment_proof_2026D012.pdf",
        mimeType: "application/pdf",
        size: 22_100,
        isPayment: true,
      },
      {
        requestId: r12.id,
        filename: "settlement_docs_2026D012.pdf",
        url: "/demo/attachments/settlement_docs_2026D012.pdf",
        mimeType: "application/pdf",
        size: 98_760,
        isSettlement: true,
      },
    ],
  });
  console.log("   ✓ 2026D012  [預付]  已結案 CLOSED");

  // ── Step 9: Payment adjustments (with AccountTransaction) ─────────────────
  console.log("\n🧾 Creating payment adjustments...");

  // Adj1: 銀行手續費 30 → linked to r7 (PAID request)
  const adj1 = await prisma.paymentAdjustment.create({
    data: {
      requestId: r7.id,
      type: "BANK_FEE",
      amount: 30,
      accountingSubjectId: subj雜費,
      occurredAt: ago(14),
      note: "兆豐銀行手續費",
      createdById: financeId,
    },
  });
  await prisma.accountTransaction.create({
    data: {
      accountId: faBank.id,
      type: "EXPENSE",
      amount: 30,
      transactionDate: ago(14),
      summary: "付款手續費 - 在宅安寧工作坊場地費",
      requestId: r7.id,
      accountingSubjectId: subj雜費,
      note: `PaymentAdjustment ${adj1.id}`,
      createdById: financeId,
    },
  });
  await prisma.notification.create({
    data: {
      userId: financeId,
      title: "付款對帳回填",
      message: `「${r7.title}」已新增銀行手續費 NT$30 對帳記錄。`,
      type: "PAYMENT_ADJUSTMENT_ADDED",
      relatedRequestId: r7.id,
      createdAt: ago(14),
      isRead: true,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: financeId, userName: financeName,
      action: "PAYMENT_ADJUSTMENT_CREATED", entityType: "PaymentAdjustment",
      entityId: adj1.id,
      description: `新增付款對帳回填：銀行手續費 NT$30（${r7.requestNumber}）`,
      createdAt: ago(14),
    },
  });
  console.log("   ✓ 銀行手續費 NT$30 (r7)");

  // Adj2: 匯費 100 → linked to r9 (PENDING_SETTLEMENT prepaid)
  const adj2 = await prisma.paymentAdjustment.create({
    data: {
      requestId: r9.id,
      type: "TRANSFER_FEE",
      amount: 100,
      accountingSubjectId: subj雜費,
      occurredAt: ago(18),
      note: "郵局跨行匯費",
      createdById: financeId,
    },
  });
  await prisma.accountTransaction.create({
    data: {
      accountId: faPost.id,
      type: "EXPENSE",
      amount: 100,
      transactionDate: ago(18),
      summary: "匯費 - 行政年度場館預付款",
      requestId: r9.id,
      accountingSubjectId: subj雜費,
      note: `PaymentAdjustment ${adj2.id}`,
      createdById: financeId,
    },
  });
  await prisma.notification.create({
    data: {
      userId: financeId,
      title: "付款對帳回填",
      message: `「${r9.title}」已新增匯費 NT$100 對帳記錄。`,
      type: "PAYMENT_ADJUSTMENT_ADDED",
      relatedRequestId: r9.id,
      createdAt: ago(18),
      isRead: true,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: financeId, userName: financeName,
      action: "PAYMENT_ADJUSTMENT_CREATED", entityType: "PaymentAdjustment",
      entityId: adj2.id,
      description: `新增付款對帳回填：匯費 NT$100（${r9.requestNumber}）`,
      createdAt: ago(18),
    },
  });
  console.log("   ✓ 匯費 NT$100 (r9)");

  // ── Step 10: Additional notifications for each role ─────────────────────
  console.log("\n🔔 Creating role-based notifications...");

  // ADMIN
  await prisma.notification.createMany({
    data: [
      {
        userId: adminId,
        title: "系統業務資料已重置",
        message: "Demo 資料已重新建立，所有業務資料已更新為最新測試情境。",
        type: "REQUEST_CLOSED",
        createdAt: ago(0, 1),
      },
      {
        userId: adminId,
        title: "有人匯出 Excel",
        message: `${financeName} 匯出了請款清單 Excel 報表。`,
        type: "PAYMENT_ADJUSTMENT_ADDED",
        createdAt: ago(1),
      },
      {
        userId: adminId,
        title: "會計科目異動",
        message: "會計科目表已匯入更新，共 120 筆科目。",
        type: "PAYMENT_ADJUSTMENT_ADDED",
        createdAt: ago(2),
      },
    ],
  });

  // PRESIDENT: 有大額入帳
  await prisma.notification.create({
    data: {
      userId: presidentId,
      title: "大額入帳通知",
      message: "郵局帳戶收到政府補助款 NT$300,000 入帳，請確認。",
      type: "PAYMENT_COMPLETED",
      createdAt: ago(10),
    },
  });

  // FINANCE: 有待付款、有沖銷、有對帳回填提醒
  await prisma.notification.createMany({
    data: [
      {
        userId: financeId,
        title: "大額入帳確認",
        message: "郵局帳戶 NT$300,000 補助款已入帳，請核實並建立對應交易記錄。",
        type: "PAYMENT_COMPLETED",
        createdAt: ago(10),
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      // Accounting subject import
      {
        userId: adminId, userName: adminName,
        action: "ACCOUNTING_SUBJECT_CREATED", entityType: "AccountingSubject",
        entityId: null,
        description: `匯入會計科目表，共 ${subjectUpserted} 筆科目`,
        createdAt: ago(2),
      },
      // Excel export
      {
        userId: financeId, userName: financeName,
        action: "DATA_EXPORTED", entityType: "Request",
        entityId: null,
        description: "匯出請款清單 Excel 報表",
        createdAt: ago(1),
      },
      // Project status changes
      {
        userId: adminId, userName: adminName,
        action: "PROJECT_STATUS_CHANGED", entityType: "Project",
        entityId: pm["零碳交通論壇"],
        description: "零碳交通論壇 專案狀態變更為 CLOSED",
        createdAt: ago(3),
      },
      // Account transactions
      {
        userId: financeId, userName: financeName,
        action: "TRANSACTION_CREATED", entityType: "AccountTransaction",
        entityId: tx1.id,
        description: "新增入帳：郵局帳戶 +NT$300,000 政府補助款（北宜新軌道）",
        createdAt: ago(10),
      },
      {
        userId: financeId, userName: financeName,
        action: "TRANSACTION_CREATED", entityType: "AccountTransaction",
        entityId: tx2.id,
        description: "新增入帳：兆豐銀行帳戶 +NT$100,000 活動收入（零碳論壇）",
        createdAt: ago(8),
      },
      {
        userId: financeId, userName: financeName,
        action: "TRANSACTION_CREATED", entityType: "AccountTransaction",
        entityId: tx3.id,
        description: "新增入帳：郵局帳戶 +NT$50,000 捐款收入（行政）",
        createdAt: ago(5),
      },
      {
        userId: financeId, userName: financeName,
        action: "TRANSACTION_CREATED", entityType: "AccountTransaction",
        entityId: tx4.id,
        description: "新增出帳：兆豐銀行帳戶 -NT$15,000 講師費（道路安全設計講座）",
        createdAt: ago(3),
      },
      {
        userId: financeId, userName: financeName,
        action: "TRANSACTION_CREATED", entityType: "AccountTransaction",
        entityId: tx5.id,
        description: "新增出帳：郵局帳戶 -NT$3,000 辦公用品採購（行政）",
        createdAt: ago(2),
      },
    ],
  });

  console.log("   ✓ ADMIN 通知 3 筆");
  console.log("   ✓ PRESIDENT 通知（大額入帳）");
  console.log("   ✓ FINANCE 通知（大額入帳確認）");
  console.log("   ✓ Audit log 補充（科目匯入、匯出、交易、專案狀態）");

  // ── Final summary ──────────────────────────────────────────────────────────
  const [uUsers, uRequests, uProjects, uFa, uAt, uNotifs, uAudit, uSubjects] =
    await Promise.all([
      prisma.user.count(),
      prisma.request.count(),
      prisma.project.count(),
      prisma.financialAccount.count(),
      prisma.accountTransaction.count(),
      prisma.notification.count(),
      prisma.auditLog.count(),
      prisma.accountingSubject.count(),
    ]);

  console.log("\n=================================================");
  console.log("✅  Production demo reset complete!\n");
  console.log(`   users               : ${uUsers}  (preserved)`);
  console.log(`   projects            : ${uProjects}`);
  console.log(`   accounting_subjects : ${uSubjects}`);
  console.log(`   financial_accounts  : ${uFa}`);
  console.log(`   account_transactions: ${uAt}`);
  console.log(`   requests            : ${uRequests}`);
  console.log(`   notifications       : ${uNotifs}`);
  console.log(`   audit_logs          : ${uAudit}`);
  console.log("=================================================\n");

  console.log("請款情境一覽：");
  console.log("  2026D001  一般  草稿 DRAFT");
  console.log("  2026D002  一般  待簽核 PENDING");
  console.log("  2026D003  一般  已抽單 WITHDRAWN");
  console.log("  2026D004  一般  理事長退回 RETURNED");
  console.log("  2026D005  一般  行政出納退回補正→重新核准 APPROVED");
  console.log("  2026D006  一般  創會理事長核准 APPROVED (待付款)");
  console.log("  2026D007  一般  已付款 PAID");
  console.log("  2026D008  一般  已拒絕 REJECTED");
  console.log("  2026D009  預付  待沖銷 PENDING_SETTLEMENT");
  console.log("  2026D010  預付  沖銷待確認 OFFSET_SUBMITTED");
  console.log("  2026D011  預付  沖銷退回補件 OFFSET_RETURNED");
  console.log("  2026D012  預付  已結案 CLOSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
