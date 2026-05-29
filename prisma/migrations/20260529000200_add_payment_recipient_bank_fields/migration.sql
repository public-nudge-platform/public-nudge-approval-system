ALTER TABLE "payment_recipients"
ADD COLUMN "bankName" TEXT,
ADD COLUMN "bankCode" TEXT,
ADD COLUMN "branchName" TEXT,
ADD COLUMN "branchCode" TEXT,
ADD COLUMN "bankAccountNumber" TEXT,
ADD COLUMN "paymentInfoNote" TEXT;

ALTER TABLE "requests"
ADD COLUMN "bankAccountNumber" TEXT;
