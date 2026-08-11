import "dotenv/config";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { resolveTeacherLevelForClass } from "../src/lib/teacher-level";

const BOARD_NAME = "Federal Board";
const CLASS_NAMES = ["Class 9", "Class 10", "Class 11", "Class 12"];
const SUBJECT_NAMES = [
  "Physics",
  "Chemistry",
  "Biology",
  "Computer",
  "Mathematics",
  "English",
  "Urdu",
  "Islamiyat",
] as const;

const ORGANIZATIONS = [
  {
    name: "The Educators Campus North",
    slug: "educators-north",
    admin: {
      name: "Org Admin North",
      email: "orgadmin.north@testgenerator.local",
      password: "Admin@12345",
    },
  },
  {
    name: "Bright Future Academy",
    slug: "bright-future-academy",
    admin: {
      name: "Org Admin Bright Future",
      email: "orgadmin.bfa@testgenerator.local",
      password: "Admin@12345",
    },
  },
  {
    name: "Scholars College",
    slug: "scholars-college",
    admin: {
      name: "Org Admin Scholars",
      email: "orgadmin.scholars@testgenerator.local",
      password: "Admin@12345",
    },
  },
] as const;

async function ensureUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true },
  });

  if (existing) {
    return existing;
  }

  const created = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  return created.user;
}

async function ensureBoard(name: string) {
  return prisma.board.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function ensureClass(boardId: string, name: string) {
  return prisma.class.upsert({
    where: { boardId_name: { boardId, name } },
    update: {},
    create: { boardId, name },
  });
}

async function ensureSubject(classId: string, name: string) {
  return prisma.subject.upsert({
    where: { classId_name: { classId, name } },
    update: {},
    create: { classId, name },
  });
}

async function ensureStarterChapterAndTopic(subjectId: string, subjectName: string) {
  const chapterName = `1. Introduction to ${subjectName}`;
  const chapter = await prisma.chapter.upsert({
    where: {
      subjectId_name: { subjectId, name: chapterName },
    },
    update: { order: 1 },
    create: {
      subjectId,
      name: chapterName,
      order: 1,
    },
  });

  await prisma.topic.upsert({
    where: {
      chapterId_name: {
        chapterId: chapter.id,
        name: `1.1 Basics of ${subjectName}`,
      },
    },
    update: { order: 1 },
    create: {
      chapterId: chapter.id,
      name: `1.1 Basics of ${subjectName}`,
      order: 1,
    },
  });
}

async function attachMembership(userId: string, organizationId: string, role: "ORG_ADMIN" | "TEACHER") {
  await prisma.orgMembership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    update: {
      role,
      isActive: true,
    },
    create: {
      userId,
      organizationId,
      role,
      isActive: true,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      organizationId,
      isActive: true,
    },
  });
}

async function main() {
  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@testgenerator.local";
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? "Admin@12345";
  const superAdminName =
    process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";

  const superAdmin = await ensureUser({
    name: superAdminName,
    email: superAdminEmail,
    password: superAdminPassword,
  });

  await prisma.user.update({
    where: { id: superAdmin.id },
    data: {
      role: "SUPER_ADMIN",
      organizationId: null,
      isActive: true,
    },
  });

  const board = await ensureBoard(BOARD_NAME);

  const subjectsByName = new Map<
    string,
    Array<{ id: string; classId: string; className: string }>
  >();
  const classesByName = new Map<string, string>();
  for (const className of CLASS_NAMES) {
    const klass = await ensureClass(board.id, className);
    classesByName.set(className, klass.id);
    for (const subjectName of SUBJECT_NAMES) {
      const subject = await ensureSubject(klass.id, subjectName);
      await ensureStarterChapterAndTopic(subject.id, subjectName);
      const list = subjectsByName.get(subjectName) ?? [];
      list.push({ id: subject.id, classId: klass.id, className });
      subjectsByName.set(subjectName, list);
    }
  }

  const teacherCredentials: Array<{
    org: string;
    subject: string;
    teacher: string;
    email: string;
    password: string;
  }> = [];

  for (const [orgIndex, orgConfig] of ORGANIZATIONS.entries()) {
    const organization = await prisma.organization.upsert({
      where: { slug: orgConfig.slug },
      update: {
        name: orgConfig.name,
        isActive: true,
      },
      create: {
        name: orgConfig.name,
        slug: orgConfig.slug,
        isActive: true,
      },
    });

    const admin = await ensureUser(orgConfig.admin);
    await attachMembership(admin.id, organization.id, "ORG_ADMIN");

    const sectionByClassId = new Map<string, string>();
    for (const [className, classId] of classesByName.entries()) {
      const sectionName = className.includes("9") || className.includes("10")
        ? "Red"
        : "A";
      const section = await prisma.section.upsert({
        where: {
          organizationId_classId_name: {
            organizationId: organization.id,
            classId,
            name: sectionName,
          },
        },
        update: {},
        create: {
          organizationId: organization.id,
          classId,
          name: sectionName,
        },
      });
      sectionByClassId.set(classId, section.id);
    }

    for (const subjectName of SUBJECT_NAMES) {
      const subjectRows = subjectsByName.get(subjectName) ?? [];
      for (let teacherNumber = 1; teacherNumber <= 2; teacherNumber += 1) {
        const email = `${orgConfig.slug}.${subjectName.toLowerCase()}.${teacherNumber}@testgenerator.local`;
        const password = "Teacher@12345";
        const name = `${subjectName} Teacher ${teacherNumber} ${orgIndex + 1}`;

        const teacher = await ensureUser({ name, email, password });
        await attachMembership(teacher.id, organization.id, "TEACHER");

        const levels = new Set(
          subjectRows
            .map((row) => resolveTeacherLevelForClass(row.className))
            .filter(Boolean),
        );
        const teacherLevel =
          levels.has("MATRIC")
            ? "MATRIC"
            : levels.has("INTERMEDIATE")
              ? "INTERMEDIATE"
              : levels.has("PRIMARY")
                ? "PRIMARY"
                : "MATRIC";

        await prisma.user.update({
          where: { id: teacher.id },
          data: { teacherLevel },
        });

        for (const subjectRow of subjectRows) {
          const level = resolveTeacherLevelForClass(subjectRow.className);
          if (level && level !== teacherLevel) continue;
          const sectionId = sectionByClassId.get(subjectRow.classId);
          if (!sectionId) continue;

          await prisma.teacherAssignment.upsert({
            where: {
              teacherId_classId_sectionId_subjectId: {
                teacherId: teacher.id,
                classId: subjectRow.classId,
                sectionId,
                subjectId: subjectRow.id,
              },
            },
            update: {},
            create: {
              teacherId: teacher.id,
              classId: subjectRow.classId,
              sectionId,
              subjectId: subjectRow.id,
            },
          });
        }

        teacherCredentials.push({
          org: orgConfig.name,
          subject: subjectName,
          teacher: name,
          email,
          password,
        });
      }
    }
  }

  console.log("Demo system seed complete");
  console.log(`Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log("Organizations:");
  for (const org of ORGANIZATIONS) {
    console.log(`- ${org.name} | ${org.admin.email} / ${org.admin.password}`);
  }
  console.log(`Board: ${BOARD_NAME}`);
  console.log(`Classes: ${CLASS_NAMES.join(", ")}`);
  console.log(`Subjects: ${SUBJECT_NAMES.join(", ")}`);
  console.log(`Teachers created: ${teacherCredentials.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
