-- CreateEnum
CREATE TYPE "StudentFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "FeeChargeStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateTable
CREATE TABLE "student" (
    "id" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_field_definition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "StudentFieldType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_field_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_field_value" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_field_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_head" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_head_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_plan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_plan_item" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "feeHeadId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "FeeFrequency" NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_charge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeHeadId" TEXT NOT NULL,
    "planItemId" TEXT,
    "periodKey" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "FeeChargeStatus" NOT NULL DEFAULT 'UNPAID',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "FeePaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payment_allocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_organizationId_idx" ON "student"("organizationId");

-- CreateIndex
CREATE INDEX "student_sectionId_idx" ON "student"("sectionId");

-- CreateIndex
CREATE INDEX "student_name_idx" ON "student"("name");

-- CreateIndex
CREATE UNIQUE INDEX "student_sectionId_rollNumber_key" ON "student"("sectionId", "rollNumber");

-- CreateIndex
CREATE INDEX "student_field_definition_organizationId_isActive_order_idx" ON "student_field_definition"("organizationId", "isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "student_field_definition_organizationId_label_key" ON "student_field_definition"("organizationId", "label");

-- CreateIndex
CREATE INDEX "student_field_value_fieldId_idx" ON "student_field_value"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "student_field_value_studentId_fieldId_key" ON "student_field_value"("studentId", "fieldId");

-- CreateIndex
CREATE INDEX "fee_head_organizationId_idx" ON "fee_head"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_head_organizationId_name_key" ON "fee_head"("organizationId", "name");

-- CreateIndex
CREATE INDEX "fee_plan_organizationId_classId_idx" ON "fee_plan"("organizationId", "classId");

-- CreateIndex
CREATE INDEX "fee_plan_sectionId_idx" ON "fee_plan"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_plan_organizationId_name_key" ON "fee_plan"("organizationId", "name");

-- CreateIndex
CREATE INDEX "fee_plan_item_feeHeadId_idx" ON "fee_plan_item"("feeHeadId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_plan_item_planId_feeHeadId_key" ON "fee_plan_item"("planId", "feeHeadId");

-- CreateIndex
CREATE INDEX "fee_charge_organizationId_periodKey_status_idx" ON "fee_charge"("organizationId", "periodKey", "status");

-- CreateIndex
CREATE INDEX "fee_charge_studentId_idx" ON "fee_charge"("studentId");

-- CreateIndex
CREATE INDEX "fee_charge_planItemId_idx" ON "fee_charge"("planItemId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_charge_studentId_feeHeadId_periodKey_key" ON "fee_charge"("studentId", "feeHeadId", "periodKey");

-- CreateIndex
CREATE INDEX "fee_payment_organizationId_paidAt_idx" ON "fee_payment"("organizationId", "paidAt");

-- CreateIndex
CREATE INDEX "fee_payment_studentId_idx" ON "fee_payment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payment_organizationId_receiptNumber_key" ON "fee_payment"("organizationId", "receiptNumber");

-- CreateIndex
CREATE INDEX "fee_payment_allocation_chargeId_idx" ON "fee_payment_allocation"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payment_allocation_paymentId_chargeId_key" ON "fee_payment_allocation"("paymentId", "chargeId");

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_field_definition" ADD CONSTRAINT "student_field_definition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_field_value" ADD CONSTRAINT "student_field_value_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_field_value" ADD CONSTRAINT "student_field_value_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "student_field_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_head" ADD CONSTRAINT "fee_head_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_plan" ADD CONSTRAINT "fee_plan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_plan" ADD CONSTRAINT "fee_plan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_plan" ADD CONSTRAINT "fee_plan_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_plan_item" ADD CONSTRAINT "fee_plan_item_planId_fkey" FOREIGN KEY ("planId") REFERENCES "fee_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_plan_item" ADD CONSTRAINT "fee_plan_item_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "fee_head"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charge" ADD CONSTRAINT "fee_charge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charge" ADD CONSTRAINT "fee_charge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charge" ADD CONSTRAINT "fee_charge_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "fee_head"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charge" ADD CONSTRAINT "fee_charge_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "fee_plan_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment" ADD CONSTRAINT "fee_payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment" ADD CONSTRAINT "fee_payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_allocation" ADD CONSTRAINT "fee_payment_allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "fee_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_allocation" ADD CONSTRAINT "fee_payment_allocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "fee_charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
