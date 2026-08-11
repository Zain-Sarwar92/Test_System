-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'SHORT', 'LONG');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('FINAL');

-- CreateEnum
CREATE TYPE "DistributionMode" AS ENUM ('BALANCED', 'RANDOM');

-- CreateEnum
CREATE TYPE "TestScheduleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherLevel" AS ENUM ('PRIMARY', 'MATRIC', 'INTERMEDIATE');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'TEACHER',
    "teacherLevel" "TeacherLevel",
    "phone" TEXT,
    "qualification" TEXT,
    "experience" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,
    "phone" TEXT,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TEACHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxTeachers" INTEGER,
    "maxTests" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "board" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_subject" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_assignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "chapterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "subType" TEXT,
    "text" TEXT NOT NULL,
    "textUrdu" TEXT,
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "correctAnswer" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT,
    "externalKey" TEXT,
    "topicId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_suggestion" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "correctAnswer" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "topicId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "questionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "totalMarks" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "classSection" TEXT,
    "examDate" TIMESTAMP(3),
    "preparedBy" TEXT,
    "paperCode" TEXT,
    "examLabel" TEXT,
    "syllabusNote" TEXT,
    "testType" TEXT,
    "distributionMode" "DistributionMode" NOT NULL DEFAULT 'BALANCED',
    "status" "TestStatus" NOT NULL DEFAULT 'FINAL',
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT,
    "scheduleAssignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "TestScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_schedule_round" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_schedule_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_schedule_subject" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_schedule_subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_schedule_subject_class" (
    "id" TEXT NOT NULL,
    "scheduleSubjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_schedule_subject_class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_schedule_assignment" (
    "id" TEXT NOT NULL,
    "scheduleSubjectClassId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sectionId" TEXT,
    "sectionName" TEXT,
    "syllabusText" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "coveredByTestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_schedule_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_question" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "textOverride" TEXT,
    "textUrduOverride" TEXT,
    "optionAOverride" TEXT,
    "optionBOverride" TEXT,
    "optionCOverride" TEXT,
    "optionDOverride" TEXT,

    CONSTRAINT "test_question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_organizationId_idx" ON "user"("organizationId");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_planId_idx" ON "organization"("planId");

-- CreateIndex
CREATE INDEX "org_membership_userId_idx" ON "org_membership"("userId");

-- CreateIndex
CREATE INDEX "org_membership_organizationId_idx" ON "org_membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "org_membership_userId_organizationId_key" ON "org_membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_name_key" ON "subscription_plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "board_name_key" ON "board"("name");

-- CreateIndex
CREATE INDEX "class_boardId_idx" ON "class"("boardId");

-- CreateIndex
CREATE UNIQUE INDEX "class_boardId_name_key" ON "class"("boardId", "name");

-- CreateIndex
CREATE INDEX "subject_classId_idx" ON "subject"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_classId_name_key" ON "subject"("classId", "name");

-- CreateIndex
CREATE INDEX "teacher_subject_teacherId_idx" ON "teacher_subject"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_subject_subjectId_idx" ON "teacher_subject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subject_teacherId_subjectId_key" ON "teacher_subject"("teacherId", "subjectId");

-- CreateIndex
CREATE INDEX "section_organizationId_idx" ON "section"("organizationId");

-- CreateIndex
CREATE INDEX "section_classId_idx" ON "section"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "section_organizationId_classId_name_key" ON "section"("organizationId", "classId", "name");

-- CreateIndex
CREATE INDEX "teacher_assignment_teacherId_idx" ON "teacher_assignment"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_assignment_classId_idx" ON "teacher_assignment"("classId");

-- CreateIndex
CREATE INDEX "teacher_assignment_sectionId_idx" ON "teacher_assignment"("sectionId");

-- CreateIndex
CREATE INDEX "teacher_assignment_subjectId_idx" ON "teacher_assignment"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_assignment_teacherId_classId_sectionId_subjectId_key" ON "teacher_assignment"("teacherId", "classId", "sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "chapter_subjectId_idx" ON "chapter"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_subjectId_name_key" ON "chapter"("subjectId", "name");

-- CreateIndex
CREATE INDEX "topic_chapterId_idx" ON "topic"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "topic_chapterId_name_key" ON "topic"("chapterId", "name");

-- CreateIndex
CREATE INDEX "question_topicId_idx" ON "question"("topicId");

-- CreateIndex
CREATE INDEX "question_type_idx" ON "question"("type");

-- CreateIndex
CREATE INDEX "question_subType_idx" ON "question"("subType");

-- CreateIndex
CREATE INDEX "question_externalKey_idx" ON "question"("externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "question_suggestion_questionId_key" ON "question_suggestion"("questionId");

-- CreateIndex
CREATE INDEX "question_suggestion_status_idx" ON "question_suggestion"("status");

-- CreateIndex
CREATE INDEX "question_suggestion_teacherId_idx" ON "question_suggestion"("teacherId");

-- CreateIndex
CREATE INDEX "question_suggestion_topicId_idx" ON "question_suggestion"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "test_scheduleAssignmentId_key" ON "test"("scheduleAssignmentId");

-- CreateIndex
CREATE INDEX "test_organizationId_idx" ON "test"("organizationId");

-- CreateIndex
CREATE INDEX "test_teacherId_idx" ON "test"("teacherId");

-- CreateIndex
CREATE INDEX "test_status_idx" ON "test"("status");

-- CreateIndex
CREATE INDEX "test_schedule_organizationId_idx" ON "test_schedule"("organizationId");

-- CreateIndex
CREATE INDEX "test_schedule_status_idx" ON "test_schedule"("status");

-- CreateIndex
CREATE INDEX "test_schedule_createdById_idx" ON "test_schedule"("createdById");

-- CreateIndex
CREATE INDEX "test_schedule_round_scheduleId_idx" ON "test_schedule_round"("scheduleId");

-- CreateIndex
CREATE INDEX "test_schedule_subject_roundId_idx" ON "test_schedule_subject"("roundId");

-- CreateIndex
CREATE INDEX "test_schedule_subject_testDate_idx" ON "test_schedule_subject"("testDate");

-- CreateIndex
CREATE UNIQUE INDEX "test_schedule_subject_roundId_subjectName_testDate_key" ON "test_schedule_subject"("roundId", "subjectName", "testDate");

-- CreateIndex
CREATE INDEX "test_schedule_subject_class_scheduleSubjectId_idx" ON "test_schedule_subject_class"("scheduleSubjectId");

-- CreateIndex
CREATE INDEX "test_schedule_subject_class_classId_idx" ON "test_schedule_subject_class"("classId");

-- CreateIndex
CREATE INDEX "test_schedule_subject_class_subjectId_idx" ON "test_schedule_subject_class"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "test_schedule_subject_class_scheduleSubjectId_classId_key" ON "test_schedule_subject_class"("scheduleSubjectId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "test_schedule_subject_class_scheduleSubjectId_subjectId_key" ON "test_schedule_subject_class"("scheduleSubjectId", "subjectId");

-- CreateIndex
CREATE INDEX "test_schedule_assignment_scheduleSubjectClassId_idx" ON "test_schedule_assignment"("scheduleSubjectClassId");

-- CreateIndex
CREATE INDEX "test_schedule_assignment_teacherId_idx" ON "test_schedule_assignment"("teacherId");

-- CreateIndex
CREATE INDEX "test_schedule_assignment_sectionId_idx" ON "test_schedule_assignment"("sectionId");

-- CreateIndex
CREATE INDEX "test_schedule_assignment_sectionName_idx" ON "test_schedule_assignment"("sectionName");

-- CreateIndex
CREATE INDEX "test_schedule_assignment_reminderSentAt_idx" ON "test_schedule_assignment"("reminderSentAt");

-- CreateIndex
CREATE INDEX "test_schedule_assignment_coveredByTestId_idx" ON "test_schedule_assignment"("coveredByTestId");

-- CreateIndex
CREATE UNIQUE INDEX "test_schedule_assignment_scheduleSubjectClassId_teacherId_s_key" ON "test_schedule_assignment"("scheduleSubjectClassId", "teacherId", "sectionName");

-- CreateIndex
CREATE INDEX "test_question_testId_idx" ON "test_question"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "test_question_testId_questionId_key" ON "test_question"("testId", "questionId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject" ADD CONSTRAINT "subject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject" ADD CONSTRAINT "teacher_subject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject" ADD CONSTRAINT "teacher_subject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignment" ADD CONSTRAINT "teacher_assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignment" ADD CONSTRAINT "teacher_assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignment" ADD CONSTRAINT "teacher_assignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignment" ADD CONSTRAINT "teacher_assignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic" ADD CONSTRAINT "topic_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_suggestion" ADD CONSTRAINT "question_suggestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_suggestion" ADD CONSTRAINT "question_suggestion_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_suggestion" ADD CONSTRAINT "question_suggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_suggestion" ADD CONSTRAINT "question_suggestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_scheduleAssignmentId_fkey" FOREIGN KEY ("scheduleAssignmentId") REFERENCES "test_schedule_assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule" ADD CONSTRAINT "test_schedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule" ADD CONSTRAINT "test_schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_round" ADD CONSTRAINT "test_schedule_round_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "test_schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_subject" ADD CONSTRAINT "test_schedule_subject_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "test_schedule_round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_subject_class" ADD CONSTRAINT "test_schedule_subject_class_scheduleSubjectId_fkey" FOREIGN KEY ("scheduleSubjectId") REFERENCES "test_schedule_subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_subject_class" ADD CONSTRAINT "test_schedule_subject_class_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_subject_class" ADD CONSTRAINT "test_schedule_subject_class_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_assignment" ADD CONSTRAINT "test_schedule_assignment_scheduleSubjectClassId_fkey" FOREIGN KEY ("scheduleSubjectClassId") REFERENCES "test_schedule_subject_class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_assignment" ADD CONSTRAINT "test_schedule_assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_assignment" ADD CONSTRAINT "test_schedule_assignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_schedule_assignment" ADD CONSTRAINT "test_schedule_assignment_coveredByTestId_fkey" FOREIGN KEY ("coveredByTestId") REFERENCES "test"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_question" ADD CONSTRAINT "test_question_testId_fkey" FOREIGN KEY ("testId") REFERENCES "test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_question" ADD CONSTRAINT "test_question_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
