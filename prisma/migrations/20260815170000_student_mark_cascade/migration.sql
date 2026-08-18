-- DropForeignKey
ALTER TABLE "student_mark" DROP CONSTRAINT "student_mark_studentId_fkey";

-- AddForeignKey
ALTER TABLE "student_mark" ADD CONSTRAINT "student_mark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
