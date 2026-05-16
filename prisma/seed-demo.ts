import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// ── Safety guards ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  console.error("\n❌  BLOCKED: This script cannot run in production (NODE_ENV=production).\n");
  process.exit(1);
}
if (process.env.ENABLE_DEMO_RESET !== "true") {
  console.error("\n❌  BLOCKED: Set ENABLE_DEMO_RESET=true to allow this operation.\n");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Demo data constants ────────────────────────────────────────────────────────
const DEMO_USERS = [
  { name: "系統管理員", email: "admin@example.com",     password: "Demo1234", role: "ADMIN"         as const },
  { name: "王理事長",   email: "president@example.com", password: "Demo1234", role: "PRESIDENT"     as const },
  { name: "陳創辦人",   email: "founder@example.com",   password: "Demo1234", role: "FOUNDER_AGENT" as const },
  { name: "林財務",     email: "finance@example.com",   password: "Demo1234", role: "FINANCE"       as const },
  { name: "李申請人",   email: "applicant@example.com", password: "Demo1234", role: "APPLICANT"     as const },
];

const DEMO_PROJECTS = [
  "行政",
  "北宜新軌道社會溝通計劃",
  "道路安全設計講座",
  "零碳交通論壇",
  "Project Sidewalk",
  "在宅安寧",
  "博愛路改造計畫",
];

const DEMO_RECIPIENTS = ["方瀚賢", "王儷潔", "鍾慧諭", "集思北科大", "集思交通部"];

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.warn("\n⚠️  WARNING: ALL existing data will be deleted and replaced with demo data.");
  console.warn(`   NODE_ENV     : ${process.env.NODE_ENV ?? "(unset — treated as non-production)"}`);
  console.warn(`   DATABASE_URL : ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "(unset)"}`);
  console.warn("\n   Proceeding in 3 seconds — press Ctrl+C to abort.\n");
  await new Promise((r) => setTimeout(r, 3000));

  // ── 1. Clear all tables (foreign-key-safe order) ────────────────────────────
  console.log("🗑️  Clearing database...");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.approvalStep.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.requestItem.deleteMany();
  await prisma.request.deleteMany();
  await prisma.paymentRecipient.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  console.log("   ✓ Done\n");

  // ── 2. Users ────────────────────────────────────────────────────────────────
  console.log("👤 Creating demo users...");
  const userMap: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.create({
      data: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
    userMap[u.email] = user.id;
    console.log(`   ✓ ${u.role.padEnd(14)} ${u.name.padEnd(8)} ${u.email}  pw: ${u.password}`);
  }

  const applicantId = userMap["applicant@example.com"];
  const presidentId = userMap["president@example.com"];
  const founderId   = userMap["founder@example.com"];
  const financeId   = userMap["finance@example.com"];

  // ── 3. Projects ─────────────────────────────────────────────────────────────
  console.log("\n📁 Creating projects...");
  const projectMap: Record<string, string> = {};
  for (const name of DEMO_PROJECTS) {
    const p = await prisma.project.create({ data: { name } });
    projectMap[name] = p.id;
    console.log(`   ✓ ${name}`);
  }

  // ── 4. Payment recipients ───────────────────────────────────────────────────
  console.log("\n💳 Creating payment recipients...");
  for (const name of DEMO_RECIPIENTS) {
    await prisma.paymentRecipient.create({ data: { name } });
    console.log(`   ✓ ${name}`);
  }

  // ── 5. Requests ─────────────────────────────────────────────────────────────
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

  console.log("\n📋 Creating demo requests...\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 1 · DRAFT · 一般請款
  // ─────────────────────────────────────────────────────────────────────────────
  const r1 = await prisma.request.create({
    data: {
      requestNumber: "2026D001",
      type:          "REIMBURSEMENT",
      status:        "DRAFT",
      title:         "辦公文具採購（草稿）",
      projectId:     projectMap["行政"],
      purpose:       "補充辦公室日常文具耗材",
      amount:        1250,
      submitterId:   applicantId,
      createdAt:     ago(1),
      items: {
        create: [
          { description: "A4 影印紙 5 包", quantity: 5, unitPrice: 150, amount: 750 },
          { description: "原子筆 2 打",    quantity: 2, unitPrice: 250, amount: 500 },
        ],
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: applicantId, userName: "李申請人",
      action: "REQUEST_CREATED", entityType: "Request", entityId: r1.id,
      description: `新增請款單 ${r1.requestNumber}「${r1.title}」`,
      createdAt: ago(1),
    },
  });
  console.log("   ✓ 2026D001  [一般]  草稿 DRAFT");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 2 · PENDING · 一般請款
  // ─────────────────────────────────────────────────────────────────────────────
  const r2 = await prisma.request.create({
    data: {
      requestNumber: "2026D002",
      type:          "REIMBURSEMENT",
      status:        "PENDING",
      title:         "道安講座場地費",
      projectId:     projectMap["道路安全設計講座"],
      purpose:       "舉辦道路安全設計工作坊場地租借費用",
      amount:        12000,
      submitterId:   applicantId,
      submittedAt:   ago(2),
      createdAt:     ago(3),
      items: {
        create: [
          { description: "場地租借半日", quantity: 1, unitPrice: 8000, amount: 8000 },
          { description: "設備使用費",   quantity: 1, unitPrice: 4000, amount: 4000 },
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
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_CREATED", entityType: "Request", entityId: r2.id,
        description: `新增請款單 ${r2.requestNumber}`, createdAt: ago(3),
      },
      {
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r2.id,
        description: `送出請款單 ${r2.requestNumber}`, createdAt: ago(2),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: presidentId,
      title:   "新的請款單待審核",
      message: `李申請人 提交了「${r2.title}」NT$12,000，請審核。`,
      type:    "REQUEST_SUBMITTED",
      relatedRequestId: r2.id,
      createdAt: ago(2),
    },
  });
  console.log("   ✓ 2026D002  [一般]  待簽核 PENDING");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 3 · WITHDRAWN · 一般請款
  // ─────────────────────────────────────────────────────────────────────────────
  const r3 = await prisma.request.create({
    data: {
      requestNumber: "2026D003",
      type:          "REIMBURSEMENT",
      status:        "WITHDRAWN",
      title:         "零碳論壇講師邀請費（已抽單）",
      projectId:     projectMap["零碳交通論壇"],
      purpose:       "邀請外部專家出席零碳交通論壇",
      amount:        8000,
      submitterId:   applicantId,
      submittedAt:   ago(6),
      createdAt:     ago(7),
      items: {
        create: [{ description: "講師費", quantity: 1, unitPrice: 8000, amount: 8000 }],
      },
      approvalSteps: {
        create: [{ stepOrder: 1, title: "理事長審核" }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_CREATED", entityType: "Request", entityId: r3.id,
        description: `新增請款單 ${r3.requestNumber}`, createdAt: ago(7),
      },
      {
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r3.id,
        description: `送出請款單 ${r3.requestNumber}`, createdAt: ago(6),
      },
      {
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_WITHDRAWN", entityType: "Request", entityId: r3.id,
        description: `抽回請款單 ${r3.requestNumber}（金額有誤，待修正）`, createdAt: ago(5),
      },
    ],
  });
  console.log("   ✓ 2026D003  [一般]  已抽單 WITHDRAWN");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 4 · RETURNED · 一般請款
  // ─────────────────────────────────────────────────────────────────────────────
  const r4 = await prisma.request.create({
    data: {
      requestNumber: "2026D004",
      type:          "REIMBURSEMENT",
      status:        "RETURNED",
      title:         "北宜新軌道宣傳印刷費（退回補件）",
      projectId:     projectMap["北宜新軌道社會溝通計劃"],
      purpose:       "製作北宜新軌道社會溝通計劃宣傳手冊",
      amount:        9600,
      submitterId:   applicantId,
      submittedAt:   ago(8),
      createdAt:     ago(9),
      items: {
        create: [
          { description: "A5 摺頁 1000 份", quantity: 1000, unitPrice: 8,   amount: 8000 },
          { description: "設計費",           quantity: 1,    unitPrice: 1600, amount: 1600 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action:     "RETURNED",
              comment:    "請補附印刷廠商報價單及發票正本後重新送件。",
              actedAt:    ago(7),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_CREATED", entityType: "Request", entityId: r4.id,
        description: `新增請款單 ${r4.requestNumber}`, createdAt: ago(9),
      },
      {
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r4.id,
        description: `送出請款單 ${r4.requestNumber}`, createdAt: ago(8),
      },
      {
        userId: presidentId, userName: "王理事長",
        action: "REQUEST_RETURNED", entityType: "Request", entityId: r4.id,
        description: `退回請款單 ${r4.requestNumber}：請補附印刷廠商報價單及發票正本`, createdAt: ago(7),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title:   "請款單已退回",
      message: `您的請款單「${r4.title}」已被退回，請補件後重新送出。`,
      type:    "REQUEST_RETURNED",
      relatedRequestId: r4.id,
      createdAt: ago(7),
    },
  });
  console.log("   ✓ 2026D004  [一般]  已退回 RETURNED");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 5 · APPROVED · 一般請款（已核准，待付款）
  // ─────────────────────────────────────────────────────────────────────────────
  const r5 = await prisma.request.create({
    data: {
      requestNumber:       "2026D005",
      type:                "REIMBURSEMENT",
      status:              "APPROVED",
      title:               "Project Sidewalk 工作坊餐費",
      projectId:           projectMap["Project Sidewalk"],
      purpose:             "Project Sidewalk 工作坊工作人員及與會者餐費",
      amount:              6000,
      submitterId:         applicantId,
      submittedAt:         ago(5),
      createdAt:           ago(6),
      paymentRecipientName: "方瀚賢",
      bankName:            "台灣銀行",
      bankCode:            "004",
      branchName:          "信義分行",
      branchCode:          "0058",
      recipientName:       "方瀚賢",
      bankLastFive:        "12345",
      items: {
        create: [
          { description: "午餐便當 20 份", quantity: 20, unitPrice: 200, amount: 4000 },
          { description: "飲料（礦泉水）", quantity: 4,  unitPrice: 500, amount: 2000 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action:     "APPROVED",
              comment:    "核准，費用合理，請財務儘速安排付款。",
              actedAt:    ago(4),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: "李申請人",
        action: "REQUEST_SUBMITTED", entityType: "Request", entityId: r5.id,
        description: `送出請款單 ${r5.requestNumber}`, createdAt: ago(5),
      },
      {
        userId: presidentId, userName: "王理事長",
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r5.id,
        description: `核准請款單 ${r5.requestNumber}`, createdAt: ago(4),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: applicantId,
        title:   "請款單已核准",
        message: `您的請款單「${r5.title}」已核准，財務將儘速安排付款。`,
        type:    "REQUEST_APPROVED",
        relatedRequestId: r5.id,
        createdAt: ago(4),
      },
      {
        userId: financeId,
        title:   "有新的付款待處理",
        message: `請款單「${r5.title}」NT$6,000 已核准，請安排付款。`,
        type:    "REQUEST_APPROVED",
        relatedRequestId: r5.id,
        createdAt: ago(4),
      },
    ],
  });
  // Dummy receipt attachment
  await prisma.attachment.create({
    data: {
      requestId: r5.id,
      filename:  "receipt_sidewalk_20260501.pdf",
      url:       "/demo/attachments/receipt_sidewalk_20260501.pdf",
      mimeType:  "application/pdf",
      size:      45230,
    },
  });
  console.log("   ✓ 2026D005  [一般]  已核准 APPROVED");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 6 · REJECTED · 一般請款
  // ─────────────────────────────────────────────────────────────────────────────
  const r6 = await prisma.request.create({
    data: {
      requestNumber: "2026D006",
      type:          "REIMBURSEMENT",
      status:        "REJECTED",
      title:         "在宅安寧專案書籍採購（已拒絕）",
      projectId:     projectMap["在宅安寧"],
      purpose:       "採購在宅安寧相關參考書籍",
      amount:        3960,
      submitterId:   applicantId,
      submittedAt:   ago(10),
      createdAt:     ago(11),
      items: {
        create: [{ description: "專業書籍", quantity: 3, unitPrice: 1320, amount: 3960 }],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "創會理事長審核",
          records: {
            create: [{
              approverId: founderId,
              action:     "REJECTED",
              comment:    "個人用途書籍不在協會核銷範圍，請重新評估需求後提出。",
              actedAt:    ago(9),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: founderId, userName: "陳創辦人",
      action: "REQUEST_REJECTED", entityType: "Request", entityId: r6.id,
      description: `拒絕請款單 ${r6.requestNumber}：個人用途書籍不在核銷範圍`,
      createdAt: ago(9),
    },
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title:   "請款單已拒絕",
      message: `您的請款單「${r6.title}」已被拒絕。原因：個人用途書籍不在協會核銷範圍。`,
      type:    "REQUEST_REJECTED",
      relatedRequestId: r6.id,
      createdAt: ago(9),
    },
  });
  console.log("   ✓ 2026D006  [一般]  已拒絕 REJECTED");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 7 · PAID · 一般請款
  // ─────────────────────────────────────────────────────────────────────────────
  const r7 = await prisma.request.create({
    data: {
      requestNumber:       "2026D007",
      type:                "REIMBURSEMENT",
      status:              "PAID",
      title:               "博愛路改造計畫社區說明會費用",
      projectId:           projectMap["博愛路改造計畫"],
      purpose:             "舉辦博愛路改造計畫社區說明會場地及餐點費用",
      amount:              4800,
      submitterId:         applicantId,
      submittedAt:         ago(14),
      createdAt:           ago(15),
      paidAt:              ago(10),
      paymentMethod:       "BANK_TRANSFER",
      paymentNote:         "已匯款至申請人帳戶，交易序號 TXN202605070001",
      paidBy:              "林財務",
      paymentRecipientName: "王儷潔",
      bankName:            "合作金庫",
      bankCode:            "006",
      branchName:          "中山分行",
      branchCode:          "0047",
      recipientName:       "王儷潔",
      bankLastFive:        "67890",
      items: {
        create: [
          { description: "場地租借費", quantity: 1, unitPrice: 3000, amount: 3000 },
          { description: "餐點費用",   quantity: 1, unitPrice: 1800, amount: 1800 },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action:     "APPROVED",
              comment:    "核准。",
              actedAt:    ago(13),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: presidentId, userName: "王理事長",
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r7.id,
        description: `核准請款單 ${r7.requestNumber}`, createdAt: ago(13),
      },
      {
        userId: financeId, userName: "林財務",
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r7.id,
        description: `標記已付款 ${r7.requestNumber}，銀行轉帳`, createdAt: ago(10),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title:   "款項已付款",
      message: `您的請款單「${r7.title}」款項 NT$4,800 已完成匯款。`,
      type:    "PAYMENT_COMPLETED",
      relatedRequestId: r7.id,
      createdAt: ago(10),
    },
  });
  await prisma.attachment.create({
    data: {
      requestId: r7.id,
      filename:  "payment_slip_2026D007.pdf",
      url:       "/demo/attachments/payment_slip_2026D007.pdf",
      mimeType:  "application/pdf",
      size:      18540,
      isPayment: true,
    },
  });
  console.log("   ✓ 2026D007  [一般]  已付款 PAID");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 8 · PENDING_SETTLEMENT · 預付請款（待沖銷）
  // ─────────────────────────────────────────────────────────────────────────────
  const r8 = await prisma.request.create({
    data: {
      requestNumber:       "2026D008",
      type:                "PREPAID",
      status:              "PENDING_SETTLEMENT",
      title:               "行政-年度場館預付款（待沖銷）",
      projectId:           projectMap["行政"],
      purpose:             "預付 2026 年度會員大會場館租借費用",
      amount:              50000,
      submitterId:         applicantId,
      submittedAt:         ago(20),
      createdAt:           ago(21),
      paidAt:              ago(15),
      paymentMethod:       "BANK_TRANSFER",
      paymentNote:         "已匯款至集思北科大，請款人需於活動後 30 日內完成沖銷。",
      paidBy:              "林財務",
      paymentRecipientName: "集思北科大",
      bankLastFive:        "11223",
      items: {
        create: [
          { description: "場地租借費（全日）", quantity: 1, unitPrice: 45000, amount: 45000 },
          { description: "清潔費",             quantity: 1, unitPrice: 5000,  amount: 5000  },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action:     "APPROVED",
              comment:    "核准，請財務安排預付款。",
              actedAt:    ago(19),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: presidentId, userName: "王理事長",
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r8.id,
        description: `核准預付請款單 ${r8.requestNumber}`, createdAt: ago(19),
      },
      {
        userId: financeId, userName: "林財務",
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r8.id,
        description: `預付款已付款 ${r8.requestNumber}，等待申請人沖銷`, createdAt: ago(15),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title:   "預付款已付款，請完成沖銷",
      message: `「${r8.title}」預付款 NT$50,000 已付款，請於活動後 30 日內上傳實際費用憑證完成沖銷。`,
      type:    "REIMBURSEMENT_REQUIRED",
      relatedRequestId: r8.id,
      createdAt: ago(15),
    },
  });
  console.log("   ✓ 2026D008  [預付]  預付待沖銷 PENDING_SETTLEMENT");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 9 · OFFSET_SUBMITTED · 預付請款（沖銷待確認）
  // ─────────────────────────────────────────────────────────────────────────────
  const r9 = await prisma.request.create({
    data: {
      requestNumber:               "2026D009",
      type:                        "PREPAID",
      status:                      "OFFSET_SUBMITTED",
      title:                       "北宜論壇講師費預付（沖銷待確認）",
      projectId:                   projectMap["北宜新軌道社會溝通計劃"],
      purpose:                     "北宜新軌道社會溝通計劃論壇系列講師費預付",
      amount:                      30000,
      submitterId:                 applicantId,
      submittedAt:                 ago(30),
      createdAt:                   ago(31),
      paidAt:                      ago(25),
      paymentMethod:               "BANK_TRANSFER",
      paidBy:                      "林財務",
      paymentRecipientName:        "鍾慧諭",
      bankLastFive:                "55678",
      actualAmount:                28500,
      reimbursementNote:           "實際場次減少一場，費用較預付少 NT$1,500，已附相關憑證。",
      reimbursementSubmittedAt:    ago(5),
      items: {
        create: [
          { description: "講師費（場次一）", quantity: 1, unitPrice: 12000, amount: 12000 },
          { description: "講師費（場次二）", quantity: 1, unitPrice: 10000, amount: 10000 },
          { description: "講師費（場次三）", quantity: 1, unitPrice: 8000,  amount: 8000  },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action:     "APPROVED",
              comment:    "核准，請安排付款。",
              actedAt:    ago(29),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: financeId, userName: "林財務",
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r9.id,
        description: `預付款已付款 ${r9.requestNumber}`, createdAt: ago(25),
      },
      {
        userId: applicantId, userName: "李申請人",
        action: "SETTLEMENT_SUBMITTED", entityType: "Request", entityId: r9.id,
        description: `送出沖銷 ${r9.requestNumber}，實際金額 NT$28,500`, createdAt: ago(5),
      },
    ],
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: financeId,
        title:   "沖銷資料待確認",
        message: `「${r9.title}」已提交沖銷資料，實際金額 NT$28,500，請確認。`,
        type:    "SETTLEMENT_SUBMITTED",
        relatedRequestId: r9.id,
        createdAt: ago(5),
      },
    ],
  });
  await prisma.attachment.create({
    data: {
      requestId:    r9.id,
      filename:     "settlement_invoices_2026D009.zip",
      url:          "/demo/attachments/settlement_invoices_2026D009.zip",
      mimeType:     "application/zip",
      size:         312400,
      isSettlement: true,
    },
  });
  console.log("   ✓ 2026D009  [預付]  沖銷待確認 OFFSET_SUBMITTED");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 10 · OFFSET_RETURNED · 預付請款（沖銷退回補件）
  // ─────────────────────────────────────────────────────────────────────────────
  const r10 = await prisma.request.create({
    data: {
      requestNumber:               "2026D010",
      type:                        "PREPAID",
      status:                      "OFFSET_RETURNED",
      title:                       "道安講座場地費預付（沖銷退回）",
      projectId:                   projectMap["道路安全設計講座"],
      purpose:                     "道路安全設計講座系列活動場地費預付",
      amount:                      20000,
      submitterId:                 applicantId,
      submittedAt:                 ago(40),
      createdAt:                   ago(41),
      paidAt:                      ago(35),
      paymentMethod:               "BANK_TRANSFER",
      paidBy:                      "林財務",
      paymentRecipientName:        "集思交通部",
      bankLastFive:                "99001",
      actualAmount:                19500,
      reimbursementNote:           "已附三場活動發票，其中一場費用減少 NT$500。",
      reimbursementSubmittedAt:    ago(10),
      offsetReviewedAt:            ago(8),
      offsetReviewedBy:            "林財務",
      offsetReviewNote:            "發票日期與活動日期不符，請補附正確日期發票或說明。",
      items: {
        create: [
          { description: "道安講座場地（場次一）", quantity: 1, unitPrice: 8000,  amount: 8000  },
          { description: "道安講座場地（場次二）", quantity: 1, unitPrice: 7000,  amount: 7000  },
          { description: "道安講座場地（場次三）", quantity: 1, unitPrice: 5000,  amount: 5000  },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: founderId,
              action:     "APPROVED",
              comment:    "核准，請安排付款。",
              actedAt:    ago(39),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: applicantId, userName: "李申請人",
        action: "SETTLEMENT_SUBMITTED", entityType: "Request", entityId: r10.id,
        description: `送出沖銷 ${r10.requestNumber}，實際金額 NT$19,500`, createdAt: ago(10),
      },
      {
        userId: financeId, userName: "林財務",
        action: "SETTLEMENT_RETURNED", entityType: "Request", entityId: r10.id,
        description: `退回沖銷 ${r10.requestNumber}：發票日期不符，需補件`, createdAt: ago(8),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title:   "沖銷資料退回補件",
      message: `「${r10.title}」沖銷資料已退回，請補附正確日期發票後重新送出。`,
      type:    "SETTLEMENT_RETURNED",
      relatedRequestId: r10.id,
      createdAt: ago(8),
    },
  });
  console.log("   ✓ 2026D010  [預付]  沖銷退回補件 OFFSET_RETURNED");

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 11 · CLOSED · 預付請款（已結案）
  // ─────────────────────────────────────────────────────────────────────────────
  const r11 = await prisma.request.create({
    data: {
      requestNumber:               "2026D011",
      type:                        "PREPAID",
      status:                      "CLOSED",
      title:                       "零碳論壇宣傳費預付（已結案）",
      projectId:                   projectMap["零碳交通論壇"],
      purpose:                     "零碳交通論壇宣傳及印刷費用預付",
      amount:                      15000,
      submitterId:                 applicantId,
      submittedAt:                 ago(60),
      createdAt:                   ago(61),
      paidAt:                      ago(55),
      paymentMethod:               "BANK_TRANSFER",
      paidBy:                      "林財務",
      paymentRecipientName:        "方瀚賢",
      bankLastFive:                "34567",
      actualAmount:                14800,
      reimbursementNote:           "實際費用 NT$14,800，較預付少 NT$200，已退還差額。",
      reimbursementSubmittedAt:    ago(30),
      offsetReviewedAt:            ago(25),
      offsetReviewedBy:            "林財務",
      offsetReviewNote:            "核銷完成，差額 NT$200 已由申請人退還。",
      items: {
        create: [
          { description: "海報設計及印刷", quantity: 1, unitPrice: 8000,  amount: 8000  },
          { description: "社群廣告費用",   quantity: 1, unitPrice: 5000,  amount: 5000  },
          { description: "活動手冊印刷",   quantity: 1, unitPrice: 2000,  amount: 2000  },
        ],
      },
      approvalSteps: {
        create: [{
          stepOrder: 1,
          title: "理事長審核",
          records: {
            create: [{
              approverId: presidentId,
              action:     "APPROVED",
              comment:    "核准，請財務安排預付。",
              actedAt:    ago(59),
            }],
          },
        }],
      },
    },
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: presidentId, userName: "王理事長",
        action: "REQUEST_APPROVED", entityType: "Request", entityId: r11.id,
        description: `核准預付請款單 ${r11.requestNumber}`, createdAt: ago(59),
      },
      {
        userId: financeId, userName: "林財務",
        action: "PAYMENT_MARKED", entityType: "Request", entityId: r11.id,
        description: `預付款已付款 ${r11.requestNumber}`, createdAt: ago(55),
      },
      {
        userId: applicantId, userName: "李申請人",
        action: "SETTLEMENT_SUBMITTED", entityType: "Request", entityId: r11.id,
        description: `送出沖銷 ${r11.requestNumber}，實際金額 NT$14,800`, createdAt: ago(30),
      },
      {
        userId: financeId, userName: "林財務",
        action: "SETTLEMENT_APPROVED", entityType: "Request", entityId: r11.id,
        description: `沖銷完成 ${r11.requestNumber}，已結案`, createdAt: ago(25),
      },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: applicantId,
      title:   "預付請款已結案",
      message: `「${r11.title}」沖銷已完成確認，案件已結案。`,
      type:    "SETTLEMENT_APPROVED",
      relatedRequestId: r11.id,
      createdAt: ago(25),
      isRead:    true,
    },
  });
  await prisma.attachment.createMany({
    data: [
      {
        requestId: r11.id,
        filename:  "payment_proof_2026D011.pdf",
        url:       "/demo/attachments/payment_proof_2026D011.pdf",
        mimeType:  "application/pdf",
        size:      22100,
        isPayment: true,
      },
      {
        requestId:    r11.id,
        filename:     "settlement_docs_2026D011.pdf",
        url:          "/demo/attachments/settlement_docs_2026D011.pdf",
        mimeType:     "application/pdf",
        size:         98760,
        isSettlement: true,
      },
    ],
  });
  console.log("   ✓ 2026D011  [預付]  已結案 CLOSED");

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n✅ Demo seed complete!\n");
  console.log("測試帳號（密碼皆為 Demo1234）：");
  console.log("─".repeat(60));
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(14)} ${u.email}`);
  }
  console.log("─".repeat(60));
  console.log("\n建立的請款情境：");
  console.log("  2026D001  一般  草稿 DRAFT");
  console.log("  2026D002  一般  待簽核 PENDING");
  console.log("  2026D003  一般  已抽單 WITHDRAWN");
  console.log("  2026D004  一般  已退回 RETURNED");
  console.log("  2026D005  一般  已核准 APPROVED");
  console.log("  2026D006  一般  已拒絕 REJECTED");
  console.log("  2026D007  一般  已付款 PAID");
  console.log("  2026D008  預付  待沖銷 PENDING_SETTLEMENT");
  console.log("  2026D009  預付  沖銷待確認 OFFSET_SUBMITTED");
  console.log("  2026D010  預付  沖銷退回補件 OFFSET_RETURNED");
  console.log("  2026D011  預付  已結案 CLOSED\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
