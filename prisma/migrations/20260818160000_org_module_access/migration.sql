-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "moduleStudents" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN     "moduleResults" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN     "moduleFees" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN     "moduleSchedules" BOOLEAN NOT NULL DEFAULT false;
