import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function initClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

// Proxy 延遲初始化：模組 import 時不建立 client，第一次呼叫 query 時才初始化
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = initClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === "function" ? (value as CallableFunction).bind(client) : value;
  },
});
