-- AlterTable
CREATE TYPE "FeeCategory" AS ENUM ('TUITION', 'TEST_DUES', 'GENERATOR', 'ADMISSION', 'LAB', 'TRANSPORT', 'OTHER');

-- AlterTable
ALTER TABLE "fee_head" ADD COLUMN "category" "FeeCategory" NOT NULL DEFAULT 'TUITION';

-- CreateIndex
CREATE INDEX "fee_head_organizationId_category_idx" ON "fee_head"("organizationId", "category");
