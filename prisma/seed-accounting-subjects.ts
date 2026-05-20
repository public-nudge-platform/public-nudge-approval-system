import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const filePath = path.resolve(__dirname, "../data/會計科目表(公民幫推).xlsx");
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 });

  // Row index 1 is the header: ["代號", "啟用", "名稱", "借/貸"]
  // Skip header row (index 1) and rows without a numeric code
  let upserted = 0;
  let skipped = 0;

  for (const row of rows.slice(2)) {
    const code = row[0];
    const isActiveRaw = row[1];
    const name = row[2];
    const direction = row[3];

    // Only import rows with a valid numeric code and non-empty name
    if (!code || typeof code !== "number" || !name || typeof name !== "string" || !name.trim()) {
      skipped++;
      continue;
    }

    const isActive = isActiveRaw === "Y";
    const dir = direction && typeof direction === "string" ? direction.trim() : "";

    await prisma.accountingSubject.upsert({
      where: { code: String(code) },
      update: { name: name.trim(), direction: dir, isActive },
      create: { code: String(code), name: name.trim(), direction: dir, isActive },
    });
    upserted++;
  }

  console.log(`會計科目匯入完成：upserted ${upserted}，skipped ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
