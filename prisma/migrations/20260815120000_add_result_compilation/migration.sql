-- CreateTable
CREATE TABLE "exam_term" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "examDate" TIMESTAMP(3),
    "passPercent" INTEGER NOT NULL DEFAULT 33,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_assessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "totalMarks" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_mark" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "obtainedMarks" DECIMAL(8,2),
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_mark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_sheet" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_term_organizationId_idx" ON "exam_term"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_term_organizationId_name_session_key" ON "exam_term"("organizationId", "name", "session");

-- CreateIndex
CREATE INDEX "subject_assessment_organizationId_idx" ON "subject_assessment"("organizationId");

-- CreateIndex
CREATE INDEX "subject_assessment_sectionId_idx" ON "subject_assessment"("sectionId");

-- CreateIndex
CREATE INDEX "subject_assessment_subjectId_idx" ON "subject_assessment"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_assessment_examTermId_sectionId_subjectId_key" ON "subject_assessment"("examTermId", "sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "student_mark_studentId_idx" ON "student_mark"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_mark_assessmentId_studentId_key" ON "student_mark"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "assessment_sheet_assessmentId_idx" ON "assessment_sheet"("assessmentId");

-- AddForeignKey
ALTER TABLE "exam_term" ADD CONSTRAINT "exam_term_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assessment" ADD CONSTRAINT "subject_assessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assessment" ADD CONSTRAINT "subject_assessment_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "exam_term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assessment" ADD CONSTRAINT "subject_assessment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assessment" ADD CONSTRAINT "subject_assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_mark" ADD CONSTRAINT "student_mark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "subject_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_mark" ADD CONSTRAINT "student_mark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_sheet" ADD CONSTRAINT "assessment_sheet_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "subject_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
