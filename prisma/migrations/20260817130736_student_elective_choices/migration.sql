-- CreateTable
CREATE TABLE "student_elective_choice" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_elective_choice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_elective_choice_studentId_idx" ON "student_elective_choice"("studentId");

-- CreateIndex
CREATE INDEX "student_elective_choice_subjectId_idx" ON "student_elective_choice"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "student_elective_choice_studentId_subjectId_key" ON "student_elective_choice"("studentId", "subjectId");

-- AddForeignKey
ALTER TABLE "student_elective_choice" ADD CONSTRAINT "student_elective_choice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_elective_choice" ADD CONSTRAINT "student_elective_choice_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
