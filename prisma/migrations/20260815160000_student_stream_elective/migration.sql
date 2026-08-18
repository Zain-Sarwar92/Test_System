-- CreateEnum
CREATE TYPE "StudentStream" AS ENUM ('SCIENCE', 'ARTS');

-- CreateEnum
CREATE TYPE "SubjectTrack" AS ENUM ('COMMON', 'SCIENCE', 'ARTS');

-- AlterTable
ALTER TABLE "subject" ADD COLUMN "track" "SubjectTrack" NOT NULL DEFAULT 'COMMON';
ALTER TABLE "subject" ADD COLUMN "electiveGroup" TEXT;

-- AlterTable
ALTER TABLE "student" ADD COLUMN "stream" "StudentStream" NOT NULL DEFAULT 'SCIENCE';
ALTER TABLE "student" ADD COLUMN "electiveSubjectId" TEXT;

-- CreateIndex
CREATE INDEX "subject_electiveGroup_idx" ON "subject"("electiveGroup");

-- CreateIndex
CREATE INDEX "student_stream_idx" ON "student"("stream");

-- CreateIndex
CREATE INDEX "student_electiveSubjectId_idx" ON "student"("electiveSubjectId");

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_electiveSubjectId_fkey" FOREIGN KEY ("electiveSubjectId") REFERENCES "subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tag science electives (Biology / Computer) from existing names
UPDATE "subject"
SET "track" = 'SCIENCE', "electiveGroup" = 'SCIENCE_ELECTIVE'
WHERE "name" ILIKE '%biology%'
   OR "name" ILIKE '%computer%';

-- Tag other common science-only subjects
UPDATE "subject"
SET "track" = 'SCIENCE'
WHERE "electiveGroup" IS NULL
  AND (
    "name" ILIKE '%physics%'
    OR "name" ILIKE '%chemistry%'
  );

-- Tag common arts-leaning subjects
UPDATE "subject"
SET "track" = 'ARTS'
WHERE "electiveGroup" IS NULL
  AND (
    "name" ILIKE '%education%'
    OR "name" ILIKE '%civics%'
    OR "name" ILIKE '%geography%'
    OR "name" ILIKE '%history%'
    OR "name" ILIKE '%economics%'
  );
