-- CreateEnum
CREATE TYPE "PaymentAdjustmentType" AS ENUM ('BANK_FEE', 'TRANSFER_FEE', 'INTERBANK_FEE', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_ADJUSTMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_ADJUSTMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_ADJUSTMENT_DELETED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_ADJUSTMENT_ADDED';

-- CreateTable
CREATE TABLE "payment_adjustments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" "PaymentAdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "accountingSubjectId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_adjustments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_accountingSubjectId_fkey" FOREIGN KEY ("accountingSubjectId") REFERENCES "accounting_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
