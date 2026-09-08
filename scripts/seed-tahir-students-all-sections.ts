import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type StudyGroup = "BIOLOGY" | "COMPUTER" | "ARTS";

type SeedRow = {
  rollSuffix: string;
  name: string;
  fatherName: string;
  phone: string;
  studyGroup: StudyGroup;
};

/** 4 students per section: Bio, Computer, Arts, Bio */
const ROSTER_TEMPLATE: SeedRow[] = [
  {
    rollSuffix: "01",
    name: "Ahmed Raza",
    fatherName: "Muhammad Raza",
    phone: "03001111001",
    studyGroup: "BIOLOGY",
  },
  {
    rollSuffix: "02",
    name: "Hassan Ali",
    fatherName: "Ali Akbar",
    phone: "03001111002",
    studyGroup: "COMPUTER",
  },
  {
    rollSuffix: "03",
    name: "Sana Malik",
    fatherName: "Malik Asif",
    phone: "03001111003",
    studyGroup: "ARTS",
  },
  {
    rollSuffix: "04",
    name: "Fatima Noor",
    fatherName: "Noor Hassan",
    phone: "03001111004",
    studyGroup: "BIOLOGY",
  },
];

function streamFrom(group: StudyGroup): "SCIENCE" | "ARTS" {
  return group === "ARTS" ? "ARTS" : "SCIENCE";
}

function rollFor(className: string, sectionName: string, suffix: string) {
  const classCode = className.includes("10") ? "10" : "9";
  return `${classCode}${sectionName}${suffix}`;
}

function phoneFor(className: string, sectionName: string, index: number) {
  const classCode = className.includes("10") ? "10" : "9";
  const sec = sectionName.charCodeAt(0) - 64; // A=1
  return `0301${classCode}${String(sec).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`;
}

async function electiveFor(classId: string, studyGroup: StudyGroup) {
  if (studyGroup === "ARTS") return null;
  const name = studyGroup === "BIOLOGY" ? "Biology" : "Computer";
  const subject = await prisma.subject.findFirst({
    where: { classId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return subject?.id ?? null;
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { equals: "tahir", mode: "insensitive" } },
        { name: { contains: "tahir", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, moduleStudents: true },
  });
  if (!org) throw new Error("Tahir organization not found");

  if (!org.moduleStudents) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { moduleStudents: true },
    });
  }

  const sections = await prisma.section.findMany({
    where: {
      organizationId: org.id,
      class: { name: { in: ["Class 9", "Class 10"] } },
    },
    select: {
      id: true,
      name: true,
      classId: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });

  if (sections.length === 0) {
    throw new Error("No Class 9/10 sections on Tahir");
  }

  console.log(`Org: ${org.name} (${org.slug})`);
  console.log(`Sections to seed: ${sections.length}`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const section of sections) {
    for (let i = 0; i < ROSTER_TEMPLATE.length; i++) {
      const row = ROSTER_TEMPLATE[i]!;
      const rollNumber = rollFor(section.class.name, section.name, row.rollSuffix);
      const existing = await prisma.student.findUnique({
        where: {
          sectionId_rollNumber: {
            sectionId: section.id,
            rollNumber,
          },
        },
        select: { id: true },
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      const studyGroup = row.studyGroup;
      const stream = streamFrom(studyGroup);
      const electiveSubjectId = await electiveFor(section.classId, studyGroup);
      const name = `${row.name} ${section.class.name.replace("Class ", "C")}${section.name}`;

      await prisma.student.create({
        data: {
          organizationId: org.id,
          sectionId: section.id,
          rollNumber,
          name,
          fatherName: row.fatherName,
          phone: phoneFor(section.class.name, section.name, i),
          stream,
          studyGroup,
          electiveSubjectId,
          isActive: true,
          monthlyFee: studyGroup === "ARTS" ? "4000.00" : "4500.00",
          ...(electiveSubjectId
            ? { electiveChoices: { create: { subjectId: electiveSubjectId } } }
            : {}),
        },
      });
      createdCount += 1;
    }
    console.log(
      `  ${section.class.name} / ${section.name}: roster ensured (${ROSTER_TEMPLATE.length} slots)`,
    );
  }

  console.log(`\nCreated: ${createdCount}, skipped existing: ${skippedCount}`);

  // -------- Tests --------
  const failures: string[] = [];

  const all = await prisma.student.findMany({
    where: {
      organizationId: org.id,
      section: { class: { name: { in: ["Class 9", "Class 10"] } } },
    },
    select: {
      id: true,
      rollNumber: true,
      name: true,
      phone: true,
      stream: true,
      studyGroup: true,
      electiveSubjectId: true,
      isActive: true,
      organizationId: true,
      sectionId: true,
      section: { select: { id: true, name: true, class: { select: { name: true } } } },
      electiveChoices: { select: { subjectId: true } },
      _count: { select: { electiveChoices: true } },
    },
  });

  for (const section of sections) {
    const inSection = all.filter((s) => s.sectionId === section.id);
    if (inSection.length < ROSTER_TEMPLATE.length) {
      failures.push(
        `${section.class.name}/${section.name} has ${inSection.length} students, expected >= ${ROSTER_TEMPLATE.length}`,
      );
    }
    const rolls = inSection.map((s) => s.rollNumber);
    const dupRolls = rolls.filter((r, idx) => rolls.indexOf(r) !== idx);
    if (dupRolls.length) {
      failures.push(`Duplicate rolls in ${section.class.name}/${section.name}: ${dupRolls.join(",")}`);
    }
  }

  // Org isolation
  const wrongOrg = all.filter((s) => s.organizationId !== org.id);
  if (wrongOrg.length) failures.push("Students with wrong organizationId");

  // Phone digit rule (>=10)
  for (const s of all) {
    const digits = s.phone.match(/\d/g)?.length ?? 0;
    if (digits < 10) failures.push(`Phone too short: ${s.rollNumber}`);
  }

  // Science must have elective when Bio/Computer; Arts must not require elective
  for (const s of all) {
    if (s.studyGroup === "BIOLOGY" || s.studyGroup === "COMPUTER") {
      if (!s.electiveSubjectId) {
        failures.push(`${s.rollNumber} missing electiveSubjectId for ${s.studyGroup}`);
      } else if (!s.electiveChoices.some((c) => c.subjectId === s.electiveSubjectId)) {
        failures.push(`${s.rollNumber} electiveChoices out of sync`);
      }
      if (s.stream !== "SCIENCE") {
        failures.push(`${s.rollNumber} studyGroup ${s.studyGroup} but stream=${s.stream}`);
      }
    }
    if (s.studyGroup === "ARTS" && s.stream !== "ARTS") {
      failures.push(`${s.rollNumber} ARTS group but stream=${s.stream}`);
    }
  }

  // Unique constraint: duplicate roll in same section must fail
  const sample = all[0];
  if (sample) {
    let dupBlocked = false;
    try {
      await prisma.student.create({
        data: {
          organizationId: org.id,
          sectionId: sample.sectionId,
          rollNumber: sample.rollNumber,
          name: "Dup Test",
          fatherName: "Dup Father",
          phone: "03009999999",
          stream: "SCIENCE",
          studyGroup: "BIOLOGY",
        },
      });
    } catch {
      dupBlocked = true;
    }
    if (!dupBlocked) failures.push("Expected unique(sectionId, rollNumber) to block duplicate");
    else console.log("OK: duplicate roll in same section rejected");
  }

  // Same roll in different section is allowed
  const class9A = sections.find((s) => s.class.name === "Class 9" && s.name === "A");
  const class9B = sections.find((s) => s.class.name === "Class 9" && s.name === "B");
  if (class9A && class9B) {
    const testRoll = "CROSS-SEC-ROLL";
    await prisma.student.deleteMany({
      where: {
        organizationId: org.id,
        rollNumber: testRoll,
        sectionId: { in: [class9A.id, class9B.id] },
      },
    });
    const a = await prisma.student.create({
      data: {
        organizationId: org.id,
        sectionId: class9A.id,
        rollNumber: testRoll,
        name: "Cross A",
        fatherName: "Test",
        phone: "03008888001",
        stream: "SCIENCE",
        studyGroup: "BIOLOGY",
      },
      select: { id: true },
    });
    const b = await prisma.student.create({
      data: {
        organizationId: org.id,
        sectionId: class9B.id,
        rollNumber: testRoll,
        name: "Cross B",
        fatherName: "Test",
        phone: "03008888002",
        stream: "SCIENCE",
        studyGroup: "COMPUTER",
      },
      select: { id: true },
    });
    console.log("OK: same roll allowed across different sections");
    await prisma.student.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }

  // Summary table
  console.log("\n--- Roster ---");
  const byKey = new Map<string, number>();
  for (const s of all) {
    const key = `${s.section.class.name} / ${s.section.name}`;
    byKey.set(key, (byKey.get(key) ?? 0) + 1);
  }
  for (const section of sections) {
    const key = `${section.class.name} / ${section.name}`;
    console.log(`  ${key}: ${byKey.get(key) ?? 0} students`);
  }
  console.log(`Total Class 9/10 students on Tahir: ${all.length}`);

  console.log("\n--- Tests ---");
  if (failures.length) {
    console.error("FAILED:");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("PASSED: students seeded + integrity/edge checks OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
