-- CreateEnum
CREATE TYPE "CurriculumAccessMode" AS ENUM ('ASSIGNED_ONLY', 'ALL_CURRICULUM');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "curriculumAccessMode" "CurriculumAccessMode" NOT NULL DEFAULT 'ASSIGNED_ONLY';
