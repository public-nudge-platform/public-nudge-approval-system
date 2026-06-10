"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAuditAction } from "@/lib/audit";

const FINANCE_VIEW_ROLES = ["ADMIN", "PRESIDENT", "FOUNDER_AGENT", "FINANCE"] as const;
const FINANCE_WRITE_ROLES = ["ADMIN", "FINANCE"] as const;

function canView(role: string): boolean {
  return (FINANCE_VIEW_ROLES as readonly string[]).includes(role);
}
function canWrite(role: string): boolean {
  return (FINANCE_WRITE_ROLES as readonly string[]).includes(role);
}

// ─── Account queries ──────────────────────────────────────────────────────────

export async function getFinancialAccounts() {
  const session = await auth();
  if (!session || !canView(session.user.role)) return [];

  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true },
    include: {
      transactions: {
        select: { type: true, amount: true, transactionDate: true, summary: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return accounts.map((acc) => {
    const balance = calcBalance(acc);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTx = acc.transactions.filter((t) => t.transactionDate >= monthStart);
    const monthIncome = monthTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount.toNumber(), 0);
    const monthExpense = monthTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount.toNumber(), 0);
    const lastTx = acc.transactions.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())[0];
    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      bankName: acc.bankName,
      accountLastFive: acc.accountLastFive,
      balance,
      monthIncome,
      monthExpense,
      lastTransaction: lastTx
        ? {
            date: lastTx.transactionDate.toISOString(),
            type: lastTx.type,
            summary: lastTx.summary,
            amount: lastTx.amount.toNumber(),
          }
        : null,
      updatedAt: acc.updatedAt.toISOString(),
    };
  });
}

function calcBalance(acc: {
  initialBalance: { toNumber(): number };
  transactions: { type: string; amount: { toNumber(): number } }[];
}): number {
  const base = acc.initialBalance.toNumber();
  return acc.transactions.reduce((sum, t) => {
    return t.type === "INCOME" ? sum + t.amount.toNumber() : sum - t.amount.toNumber();
  }, base);
}

function buildTransactionOrderBy(sortBy: string | undefined, sortDir: "asc" | "desc") {
  switch (sortBy) {
    case "type":
      return { type: sortDir };
    case "amount":
      return { amount: sortDir };
    case "summary":
      return { summary: sortDir };
    case "counterparty":
      return { counterparty: { sort: sortDir, nulls: "last" as const } };
    case "project":
      return { project: { name: sortDir } };
    case "accountingSubject":
      return { accountingSubject: { code: sortDir } };
    case "transactionDate":
    default:
      return { transactionDate: sortDir };
  }
}

export async function getAccountDetail(accountId: string, params?: {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  projectId?: string;
  keyword?: string;
  sortBy?: string;
  sortDir?: string;
}) {
  const session = await auth();
  if (!session || !canView(session.user.role)) return null;

  const sortDir: "asc" | "desc" = params?.sortDir === "asc" ? "asc" : "desc";

  const account = await prisma.financialAccount.findUnique({
    where: { id: accountId },
    include: {
      transactions: {
        where: {
          ...(params?.type && params.type !== "ALL" && { type: params.type as "INCOME" | "EXPENSE" }),
          ...(params?.projectId && { projectId: params.projectId }),
          ...(params?.keyword && {
            OR: [
              { summary: { contains: params.keyword, mode: "insensitive" } },
              { counterparty: { contains: params.keyword, mode: "insensitive" } },
              { note: { contains: params.keyword, mode: "insensitive" } },
            ],
          }),
          ...((params?.dateFrom || params?.dateTo) && {
            transactionDate: {
              ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
              ...(params.dateTo && { lte: new Date(`${params.dateTo}T23:59:59`) }),
            },
          }),
        },
        include: {
          project: { select: { id: true, name: true } },
          accountingSubject: { select: { code: true, name: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: buildTransactionOrderBy(params?.sortBy, sortDir),
      },
    },
  });

  if (!account) return null;

  const allTx = await prisma.accountTransaction.findMany({
    where: { accountId },
    select: { type: true, amount: true, transactionDate: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const balance = calcBalance({ initialBalance: account.initialBalance, transactions: allTx });
  const monthIncome = allTx.filter((t) => t.type === "INCOME" && t.transactionDate >= monthStart).reduce((s, t) => s + t.amount.toNumber(), 0);
  const monthExpense = allTx.filter((t) => t.type === "EXPENSE" && t.transactionDate >= monthStart).reduce((s, t) => s + t.amount.toNumber(), 0);

  return {
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      bankName: account.bankName,
      accountLastFive: account.accountLastFive,
      initialBalance: account.initialBalance.toNumber(),
      balance,
      monthIncome,
      monthExpense,
    },
    transactions: account.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toNumber(),
      transactionDate: t.transactionDate.toISOString(),
      summary: t.summary,
      counterparty: t.counterparty,
      project: t.project,
      accountingSubject: t.accountingSubject,
      request: t.request,
      note: t.note,
      createdByName: t.createdBy.name,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

// ─── Create transaction ───────────────────────────────────────────────────────

type CreateTransactionInput = {
  accountId: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  transactionDate: string;
  summary: string;
  counterparty?: string;
  projectId?: string;
  accountingSubjectId?: string;
  requestId?: string;
  note?: string;
};

export async function createTransaction(input: CreateTransactionInput) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!canWrite(session.user.role)) return { error: "無資金管理權限" };

  if (!input.summary?.trim()) return { error: "摘要為必填" };
  if (!input.amount || input.amount <= 0) return { error: "金額必須大於 0" };
  if (!input.transactionDate || isNaN(Date.parse(input.transactionDate))) return { error: "日期格式不正確" };

  const account = await prisma.financialAccount.findUnique({ where: { id: input.accountId, isActive: true } });
  if (!account) return { error: "找不到帳戶" };

  const tx = await prisma.accountTransaction.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      transactionDate: new Date(input.transactionDate),
      summary: input.summary.trim(),
      counterparty: input.counterparty?.trim() || null,
      projectId: input.projectId || null,
      accountingSubjectId: input.accountingSubjectId || null,
      requestId: input.requestId || null,
      note: input.note?.trim() || null,
      createdById: session.user.id,
    },
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "TRANSACTION_CREATED",
    entityType: "AccountTransaction",
    entityId: tx.id,
    description: `新增${input.type === "INCOME" ? "入帳" : "出帳"}「${input.summary}」，帳戶：${account.name}，金額：${input.amount}`,
    afterData: { accountId: input.accountId, type: input.type, amount: input.amount },
  });

  revalidatePath("/financial-accounts");
  revalidatePath(`/financial-accounts/${input.accountId}`);
  revalidatePath("/dashboard");

  return { ok: true, id: tx.id };
}

export async function updateAccountInfo(accountId: string, data: { accountLastFive?: string; initialBalance?: number; note?: string }) {
  const session = await auth();
  if (!session) return { error: "未登入" };
  if (!["ADMIN"].includes(session.user.role)) return { error: "需要管理員權限" };

  const account = await prisma.financialAccount.findUnique({ where: { id: accountId } });
  if (!account) return { error: "找不到帳戶" };

  await prisma.financialAccount.update({
    where: { id: accountId },
    data: {
      ...(data.accountLastFive !== undefined && { accountLastFive: data.accountLastFive || null }),
      ...(data.initialBalance !== undefined && { initialBalance: data.initialBalance }),
      ...(data.note !== undefined && { note: data.note || null }),
    },
  });

  await logAuditAction({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "unknown",
    action: "FINANCIAL_ACCOUNT_UPDATED",
    entityType: "FinancialAccount",
    entityId: accountId,
    description: `更新帳戶資訊：${account.name}`,
    afterData: data,
  });

  revalidatePath("/financial-accounts");
  revalidatePath(`/financial-accounts/${accountId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
