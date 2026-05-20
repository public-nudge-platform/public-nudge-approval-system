-- CreateTable
CREATE TABLE "accounting_subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_subjects_code_key" ON "accounting_subjects"("code");

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "accountingSubjectId" TEXT,
ADD COLUMN     "finalAccountingSubjectId" TEXT;

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNTING_SUBJECT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNTING_SUBJECT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNTING_SUBJECT_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNTING_SUBJECT_CHANGED';

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_accountingSubjectId_fkey" FOREIGN KEY ("accountingSubjectId") REFERENCES "accounting_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_finalAccountingSubjectId_fkey" FOREIGN KEY ("finalAccountingSubjectId") REFERENCES "accounting_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
