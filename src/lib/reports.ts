import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportLineItem = {
  code: string;
  name: string;
  amount: number;
};

export type ExpenseGroup = {
  groupName: string;
  items: ReportLineItem[];
  subtotal: number;
};

export type IncomeExpenseStatement = {
  orgName: string;
  projectId: string | null;
  projectName: string | null;
  periodFrom: Date;
  periodTo: Date;
  incomeItems: ReportLineItem[];
  incomeTotal: number;
  expenseGroups: ExpenseGroup[];
  expenseTotal: number;
  netSurplus: number;
};

export type BalanceCashAccount = {
  accountId: string;
  name: string;
  balance: number;
  code: string;
};

export type BalanceSheet = {
  orgName: string;
  asOf: Date;
  // Assets
  cashAccounts: BalanceCashAccount[];
  cashTotal: number;
  receivables: number;
  prepaid: number;
  currentAssetsTotal: number;
  assetsTotal: number;
  // Liabilities
  payables: number;
  preReceived: number;
  currentLiabilitiesTotal: number;
  liabilitiesTotal: number;
  // Fund & surplus
  accumulatedSurplus: number;
  currentSurplus: number;
  fundTotal: number;
  liabilitiesAndFundTotal: number;
  balanced: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expenseGroupName(code: string): string {
  const n = parseInt(code, 10);
  if (n >= 5100 && n < 5200) return "人事費";
  if (n >= 5200 && n < 5300) return "辦公費";
  if (n >= 5300 && n < 5400) return "設備費";
  if (n >= 5800 && n < 5900) return "專案支出";
  return "其他支出";
}

function accountSubjectCode(acc: { type: string; name: string }): string {
  if (acc.name.includes("零用金")) return "1110";
  if (acc.type === "POST_OFFICE" || acc.name.includes("郵局")) return "1121";
  return "1122";
}

// ─── Income / Expense Statement ───────────────────────────────────────────────

export async function generateIncomeExpenseStatement(params: {
  from: Date;
  to: Date;
  projectId?: string;
}): Promise<IncomeExpenseStatement> {
  const { from, to, projectId } = params;

  const transactions = await prisma.accountTransaction.findMany({
    where: {
      transactionDate: { gte: from, lte: to },
      ...(projectId ? { projectId } : {}),
    },
    select: {
      type: true,
      amount: true,
      accountingSubject: { select: { code: true, name: true } },
    },
  });

  const incomeMap = new Map<string, ReportLineItem>();
  const expenseMap = new Map<string, ReportLineItem>();

  for (const tx of transactions) {
    if (!tx.accountingSubject) continue;
    const { code, name } = tx.accountingSubject;
    const amt = Number(tx.amount);

    if (tx.type === "INCOME" && code.startsWith("4")) {
      const existing = incomeMap.get(code);
      if (existing) existing.amount += amt;
      else incomeMap.set(code, { code, name, amount: amt });
    } else if (tx.type === "EXPENSE" && code.startsWith("5")) {
      const existing = expenseMap.get(code);
      if (existing) existing.amount += amt;
      else expenseMap.set(code, { code, name, amount: amt });
    }
  }

  const incomeItems = [...incomeMap.values()].sort((a, b) =>
    a.code.localeCompare(b.code)
  );
  const incomeTotal = incomeItems.reduce((s, i) => s + i.amount, 0);

  // Group expenses by category
  const groupBuckets = new Map<string, ReportLineItem[]>();
  for (const item of [...expenseMap.values()].sort((a, b) =>
    a.code.localeCompare(b.code)
  )) {
    const gName = expenseGroupName(item.code);
    const bucket = groupBuckets.get(gName) ?? [];
    bucket.push(item);
    groupBuckets.set(gName, bucket);
  }

  // Preserve meaningful order
  const GROUP_ORDER = ["人事費", "辦公費", "設備費", "專案支出", "其他支出"];
  const expenseGroups: ExpenseGroup[] = GROUP_ORDER.flatMap((gName) => {
    const items = groupBuckets.get(gName);
    if (!items || items.length === 0) return [];
    return [{ groupName: gName, items, subtotal: items.reduce((s, i) => s + i.amount, 0) }];
  });
  // Append any unlisted groups
  for (const [gName, items] of groupBuckets) {
    if (!GROUP_ORDER.includes(gName)) {
      expenseGroups.push({ groupName: gName, items, subtotal: items.reduce((s, i) => s + i.amount, 0) });
    }
  }

  const expenseTotal = expenseGroups.reduce((s, g) => s + g.subtotal, 0);

  let projectName: string | null = null;
  if (projectId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    projectName = proj?.name ?? null;
  }

  return {
    orgName: "公民幫推",
    projectId: projectId ?? null,
    projectName,
    periodFrom: from,
    periodTo: to,
    incomeItems,
    incomeTotal,
    expenseGroups,
    expenseTotal,
    netSurplus: incomeTotal - expenseTotal,
  };
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

export async function generateBalanceSheet(params: {
  asOf: Date;
}): Promise<BalanceSheet> {
  const { asOf } = params;

  // Cash / bank accounts
  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      transactions: {
        where: { transactionDate: { lte: asOf } },
        select: { type: true, amount: true },
      },
    },
  });

  const cashAccounts: BalanceCashAccount[] = accounts.map((acc) => {
    const income = acc.transactions
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = acc.transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((s, t) => s + Number(t.amount), 0);
    const balance = Number(acc.initialBalance) + income - expense;
    return {
      accountId: acc.id,
      name: acc.name,
      balance,
      code: accountSubjectCode(acc),
    };
  });
  const cashTotal = cashAccounts.reduce((s, a) => s + a.balance, 0);

  // 1230 應收款項 — transactions tagged with subject code 1230
  const receivableTxs = await prisma.accountTransaction.findMany({
    where: {
      transactionDate: { lte: asOf },
      accountingSubject: { code: "1230" },
    },
    select: { type: true, amount: true },
  });
  const receivables = Math.max(
    receivableTxs.reduce(
      (s, t) => s + (t.type === "INCOME" ? Number(t.amount) : -Number(t.amount)),
      0
    ),
    0
  );

  // 1250 預付款項 — prepaid requests paid but not yet closed
  const prepaidReqs = await prisma.request.findMany({
    where: {
      type: "PREPAID",
      status: { in: ["PENDING_SETTLEMENT", "OFFSET_SUBMITTED", "OFFSET_RETURNED"] },
      paidAt: { lte: asOf },
    },
    select: { amount: true, actualAmount: true },
  });
  const prepaid = prepaidReqs.reduce(
    (s, r) => s + Number(r.actualAmount ?? r.amount),
    0
  );

  const currentAssetsTotal = cashTotal + receivables + prepaid;
  const assetsTotal = currentAssetsTotal;

  // 2130 應付款項 — approved but unpaid requests as of asOf
  const payableReqs = await prisma.request.findMany({
    where: {
      status: "APPROVED",
      updatedAt: { lte: asOf },
    },
    select: { amount: true },
  });
  const payables = payableReqs.reduce((s, r) => s + Number(r.amount), 0);

  // 2150 預收款項 — transactions tagged with subject code 2150
  const preReceivedTxs = await prisma.accountTransaction.findMany({
    where: {
      transactionDate: { lte: asOf },
      accountingSubject: { code: "2150" },
    },
    select: { type: true, amount: true },
  });
  const preReceived = Math.max(
    preReceivedTxs.reduce(
      (s, t) => s + (t.type === "INCOME" ? Number(t.amount) : -Number(t.amount)),
      0
    ),
    0
  );

  const currentLiabilitiesTotal = payables + preReceived;
  const liabilitiesTotal = currentLiabilitiesTotal;

  // 3210 累計餘絀 — transactions tagged with subject code 3210 (opening entries)
  const accumulatedTxs = await prisma.accountTransaction.findMany({
    where: {
      transactionDate: { lte: asOf },
      accountingSubject: { code: "3210" },
    },
    select: { type: true, amount: true },
  });
  const accumulatedSurplus = accumulatedTxs.reduce(
    (s, t) => s + (t.type === "INCOME" ? Number(t.amount) : -Number(t.amount)),
    0
  );

  // 3440 本期餘絀 — YTD income minus YTD expense for the fiscal year
  const yearStart = new Date(asOf.getFullYear(), 0, 1);
  const ytdTxs = await prisma.accountTransaction.findMany({
    where: {
      transactionDate: { gte: yearStart, lte: asOf },
    },
    select: {
      type: true,
      amount: true,
      accountingSubject: { select: { code: true } },
    },
  });
  let ytdIncome = 0;
  let ytdExpense = 0;
  for (const tx of ytdTxs) {
    if (!tx.accountingSubject) continue;
    if (tx.type === "INCOME" && tx.accountingSubject.code.startsWith("4")) {
      ytdIncome += Number(tx.amount);
    } else if (tx.type === "EXPENSE" && tx.accountingSubject.code.startsWith("5")) {
      ytdExpense += Number(tx.amount);
    }
  }
  const currentSurplus = ytdIncome - ytdExpense;

  const fundTotal = accumulatedSurplus + currentSurplus;
  const liabilitiesAndFundTotal = liabilitiesTotal + fundTotal;
  const balanced = Math.abs(assetsTotal - liabilitiesAndFundTotal) < 1;

  return {
    orgName: "公民幫推",
    asOf,
    cashAccounts,
    cashTotal,
    receivables,
    prepaid,
    currentAssetsTotal,
    assetsTotal,
    payables,
    preReceived,
    currentLiabilitiesTotal,
    liabilitiesTotal,
    accumulatedSurplus,
    currentSurplus,
    fundTotal,
    liabilitiesAndFundTotal,
    balanced,
  };
}

// ─── Date helpers (shared with export routes) ─────────────────────────────────

export function parsePeriodParams(params: {
  month?: string;
  startDate?: string;
  endDate?: string;
}): { from: Date; to: Date } | null {
  const { month, startDate, endDate } = params;

  if (startDate || endDate) {
    const from = startDate ? new Date(startDate) : new Date("2000-01-01");
    const to = endDate ? new Date(`${endDate}T23:59:59`) : new Date();
    return { from, to };
  }
  if (month) {
    const [y, m] = month.split("-").map(Number);
    return {
      from: new Date(y, m - 1, 1),
      to: new Date(y, m, 0, 23, 59, 59),
    };
  }
  return null;
}

export function formatDateDisplay(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatAmount(n: number): string {
  return n.toLocaleString("zh-TW");
}
