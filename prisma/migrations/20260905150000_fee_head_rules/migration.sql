-- AlterTable
ALTER TABLE "fee_head" ADD COLUMN IF NOT EXISTS "default_amount" DECIMAL(12,2);
ALTER TABLE "fee_head" ADD COLUMN IF NOT EXISTS "frequency" "FeeFrequency" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "fee_head" ADD COLUMN IF NOT EXISTS "applicable_months" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
