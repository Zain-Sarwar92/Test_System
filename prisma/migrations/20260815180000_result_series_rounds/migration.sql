-- CreateTable
CREATE TABLE "result_series" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "passPercent" INTEGER NOT NULL DEFAULT 33,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "result_series_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "exam_term" ADD COLUMN "seriesId" TEXT,
ADD COLUMN "roundOrder" INTEGER;

-- CreateIndex
CREATE INDEX "result_series_organizationId_idx" ON "result_series"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "result_series_organizationId_name_session_key" ON "result_series"("organizationId", "name", "session");

-- CreateIndex
CREATE INDEX "exam_term_seriesId_idx" ON "exam_term"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_term_seriesId_roundOrder_key" ON "exam_term"("seriesId", "roundOrder");

-- AddForeignKey
ALTER TABLE "result_series" ADD CONSTRAINT "result_series_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_term" ADD CONSTRAINT "exam_term_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "result_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
