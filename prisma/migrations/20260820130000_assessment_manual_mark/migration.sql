-- CreateTable
CREATE TABLE "assessment_manual_mark" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL DEFAULT '',
    "obtainedMarks" DECIMAL(8,2),
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_manual_mark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_manual_mark_assessmentId_idx" ON "assessment_manual_mark"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_manual_mark_assessmentId_rollNumber_key" ON "assessment_manual_mark"("assessmentId", "rollNumber");

-- AddForeignKey
ALTER TABLE "assessment_manual_mark" ADD CONSTRAINT "assessment_manual_mark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "subject_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
