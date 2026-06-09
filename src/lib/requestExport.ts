import ExcelJS from "exceljs";
import path from "node:path";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/lib/templates/personal-expense-request-template.xlsx"
);

const ITEM_START_ROW = 6;
const MAX_ITEMS = 5;

export class TooManyItemsError extends Error {
  constructor(
    public readonly count: number,
    public readonly max: number
  ) {
    super(`費用明細項目數（${count}）超過範本可容納上限（${max}），請拆分後再匯出`);
    this.name = "TooManyItemsError";
  }
}

export type ExportableRequestItem = {
  description: string;
  quantity: number;
  unitPrice: unknown;
  amount: unknown;
  voucherDate: Date | null;
};

export type ExportableRequest = {
  requestNumber: string | null;
  requestDate: Date;
  submitter: { name: string };
  project: { name: string } | null;
  projectName: string | null;
  finalAccountingSubject: { code: string; name: string } | null;
  items: ExportableRequestItem[];
};

const ITEM_COLUMNS = ["A", "B", "C", "D", "E", "F", "K", "L", "M", "N", "P"] as const;

/**
 * Loads the "差旅及個人請款" paper-form template (公民幫推 / 個人支出_給付款申請單)
 * and fills in the data cells, preserving the template's exact layout and styling.
 */
export async function buildRequestWorkbook(request: ExportableRequest): Promise<ExcelJS.Workbook> {
  if (request.items.length > MAX_ITEMS) {
    throw new TooManyItemsError(request.items.length, MAX_ITEMS);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.worksheets[0];

  const projectName = request.project?.name ?? request.projectName ?? "";
  const subjectLabel = request.finalAccountingSubject
    ? `${request.finalAccountingSubject.code} ${request.finalAccountingSubject.name}`
    : "";

  ws.getCell("C3").value = request.submitter.name;
  const requestDateCell = ws.getCell("H3");
  requestDateCell.value = request.requestDate;
  requestDateCell.numFmt = "yyyy/m/d";
  ws.getCell("M3").value = projectName;

  // Template label says "專案代號"; system has no project codes, only names.
  ws.getCell("B4").value = "專案名稱";

  let subtotal = 0;
  for (let i = 0; i < MAX_ITEMS; i++) {
    const row = ITEM_START_ROW + i;
    const item = request.items[i];

    if (!item) {
      for (const col of ITEM_COLUMNS) ws.getCell(`${col}${row}`).value = null;
      continue;
    }

    const unitPrice = Number(item.unitPrice);
    const amount = Number(item.amount);
    subtotal += amount;

    ws.getCell(`A${row}`).value = i + 1;
    ws.getCell(`B${row}`).value = projectName;
    if (item.voucherDate) {
      ws.getCell(`C${row}`).value = item.voucherDate.getFullYear();
      ws.getCell(`D${row}`).value = item.voucherDate.getMonth() + 1;
      ws.getCell(`E${row}`).value = item.voucherDate.getDate();
    } else {
      ws.getCell(`C${row}`).value = null;
      ws.getCell(`D${row}`).value = null;
      ws.getCell(`E${row}`).value = null;
    }
    ws.getCell(`F${row}`).value = item.description;
    ws.getCell(`K${row}`).value = item.quantity;
    ws.getCell(`L${row}`).value = unitPrice;
    ws.getCell(`M${row}`).value = 0; // 稅金：系統無稅務概念
    ws.getCell(`N${row}`).value = amount; // 合計：靜態值，取代範本公式
    ws.getCell(`P${row}`).value = subjectLabel;
  }

  // 小計／稅金／請款總計：以靜態值取代範本公式（系統無稅務概念，稅金恆為 0）
  ws.getCell("N11").value = subtotal;
  ws.getCell("N12").value = 0;
  ws.getCell("N13").value = subtotal;

  return wb;
}
