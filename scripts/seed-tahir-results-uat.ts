/**
 * Tahir · Class 9:
 *  - Section A: 25 Bio/Computer only
 *  - Section B: 25 Bio/Computer only
 *  - Section Arts (new): 25 Arts only
 * Then create exam + marks for all three and verify.
 */
import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { academicSession } from "../src/lib/results";
import {
  chosenElectiveIds,
  isDefaultResultSubject,
  isStudentEnrolledInSubject,
  SCIENCE_ELECTIVE_GROUP,
  type StudentStream,
} from "../src/lib/subject-stream";
import { prisma } from "../src/lib/prisma";

function isEthicsSubjectName(name: string) {
  const n = name.toLowerCase();
  return (
    n.includes("ethics") ||
    name.includes("اخلاقیات") ||
    n.includes("akhlaq")
  );
}

const FIRST = [
  "Ahmed", "Hassan", "Bilal", "Usman", "Zain", "Hamza", "Omar", "Saad", "Ali", "Kashif",
  "Ayesha", "Fatima", "Sana", "Hira", "Laiba", "Nimra", "Iqra", "Maryam", "Noor", "Sara",
  "Daniyal", "Raza", "Taha", "Yousaf", "Imran", "Asim", "Nadeem", "Farah", "Maham", "Zoya",
];
const LAST = [
  "Khan", "Raza", "Ali", "Ahmed", "Malik", "Sheikh", "Iqbal", "Hussain", "Abbas", "Shah",
  "Akbar", "Mehmood", "Noor", "Javed", "Farooq", "Yousaf", "Rauf", "Asghar", "Nawaz", "Qureshi",
];

type SciGroup = "BIOLOGY" | "COMPUTER";

function hashMark(seed: string, total: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const min = Math.ceil(total * 0.4);
  const max = Math.floor(total * 0.95);
  return min + (h % (max - min + 1));
}

function buildScienceRoster(sectionTag: string, count: number) {
  const rows: Array<{
    rollNumber: string;
    name: string;
    fatherName: string;
    phone: string;
    studyGroup: SciGroup;
  }> = [];
  for (let i = 0; i < count; i++) {
    const studyGroup: SciGroup = i % 2 === 0 ? "BIOLOGY" : "COMPUTER";
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 3) % LAST.length]!;
    rows.push({
      rollNumber: `${sectionTag}${String(i + 1).padStart(2, "0")}`,
      name: `${first} ${last}`,
      fatherName: `${LAST[(i + 5) % LAST.length]} ${FIRST[(i + 2) % FIRST.length]}`,
      phone: `0301${sectionTag === "9A" ? "91" : "92"}${String(i + 1).padStart(6, "0")}`,
      studyGroup,
    });
  }
  return rows;
}

function buildArtsRoster(count: number) {
  const rows: Array<{
    rollNumber: string;
    name: string;
    fatherName: string;
    phone: string;
  }> = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[(i + 7) % FIRST.length]!;
    const last = LAST[(i * 2 + 1) % LAST.length]!;
    rows.push({
      rollNumber: `9R${String(i + 1).padStart(2, "0")}`,
      name: `${first} ${last}`,
      fatherName: `${LAST[(i + 3) % LAST.length]} Parent`,
      phone: `030193${String(i + 1).padStart(6, "0")}`,
    });
  }
  return rows;
}

async function electiveFor(classId: string, studyGroup: SciGroup) {
  const name = studyGroup === "BIOLOGY" ? "Biology" : "Computer";
  const subject = await prisma.subject.findFirst({
    where: { classId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return subject?.id ?? null;
}

async function artsElectiveId(classId: string) {
  const preferred = await prisma.subject.findFirst({
    where: {
      classId,
      electiveGroup: "ARTS_ELECTIVE",
      OR: [
        { name: { contains: "ایجوکیشن" } },
        { name: { contains: "Education", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });
  if (preferred) return preferred;
  return prisma.subject.findFirst({
    where: { classId, electiveGroup: "ARTS_ELECTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function wipeSectionStudents(ids: string[]) {
  if (!ids.length) return;
  await prisma.feePaymentAllocation.deleteMany({
    where: { payment: { studentId: { in: ids } } },
  });
  await prisma.feePaymentAllocation.deleteMany({
    where: { charge: { studentId: { in: ids } } },
  });
  await prisma.feePayment.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.feeCharge.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.studentMark.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.studentElectiveChoice.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.studentFieldValue.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.student.deleteMany({ where: { id: { in: ids } } });
}

type StudentRow = {
  id: string;
  rollNumber: string;
  stream: StudentStream;
  studyGroup: string | null;
  electiveSubjectId: string | null;
  electiveChoices: Array<{ subjectId: string }>;
};

async function seedExamMarks(input: {
  organizationId: string;
  examTermId: string;
  sectionId: string;
  classId: string;
  students: StudentRow[];
  mode: "SCIENCE" | "ARTS";
  seedPrefix: string;
  totalMarks?: number;
}) {
  const total = input.totalMarks ?? 100;
  const old = await prisma.subjectAssessment.findMany({
    where: {
      organizationId: input.organizationId,
      examTermId: input.examTermId,
      sectionId: input.sectionId,
    },
    select: { id: true },
  });
  const oldIds = old.map((a) => a.id);
  if (oldIds.length) {
    await prisma.studentMark.deleteMany({ where: { assessmentId: { in: oldIds } } });
    await prisma.assessmentManualMark.deleteMany({ where: { assessmentId: { in: oldIds } } });
    await prisma.assessmentSheet.deleteMany({ where: { assessmentId: { in: oldIds } } });
    await prisma.subjectAssessment.deleteMany({ where: { id: { in: oldIds } } });
  }

  const allSubjects = await prisma.subject.findMany({
    where: { classId: input.classId },
    select: { id: true, name: true, track: true, electiveGroup: true },
  });

  const useSubjects =
    input.mode === "SCIENCE"
      ? allSubjects.filter(
          (subject) =>
            isDefaultResultSubject(subject) && !isEthicsSubjectName(subject.name),
        )
      : allSubjects.filter((subject) => {
          if (isEthicsSubjectName(subject.name)) return false;
          if (subject.electiveGroup === SCIENCE_ELECTIVE_GROUP) return false;
          if (subject.track === "SCIENCE") return false; // Chem/Physics out for Arts
          if (subject.track === "COMMON") return true;
          if (subject.track === "ARTS") return true;
          return false;
        });

  let markCount = 0;
  const usedSubjects: string[] = [];
  for (const subject of useSubjects) {
    let anyEnrolled = false;
    for (const student of input.students) {
      const electiveIds = chosenElectiveIds({
        electiveSubjectId: student.electiveSubjectId,
        electiveChoiceIds: student.electiveChoices.map((c) => c.subjectId),
      });
      if (
        isStudentEnrolledInSubject(
          {
            stream: student.stream,
            studyGroup: student.studyGroup,
            electiveSubjectId: student.electiveSubjectId,
            electiveChoiceIds: electiveIds,
          },
          subject,
        )
      ) {
        anyEnrolled = true;
        break;
      }
    }
    if (!anyEnrolled) continue;

    const assessment = await prisma.subjectAssessment.create({
      data: {
        organizationId: input.organizationId,
        examTermId: input.examTermId,
        sectionId: input.sectionId,
        subjectId: subject.id,
        totalMarks: new Prisma.Decimal(total),
      },
      select: { id: true },
    });
    usedSubjects.push(subject.name);

    for (const student of input.students) {
      const electiveIds = chosenElectiveIds({
        electiveSubjectId: student.electiveSubjectId,
        electiveChoiceIds: student.electiveChoices.map((c) => c.subjectId),
      });
      if (
        !isStudentEnrolledInSubject(
          {
            stream: student.stream,
            studyGroup: student.studyGroup,
            electiveSubjectId: student.electiveSubjectId,
            electiveChoiceIds: electiveIds,
          },
          subject,
        )
      ) {
        continue;
      }
      const absent = student.rollNumber.endsWith("25");
      await prisma.studentMark.create({
        data: {
          assessmentId: assessment.id,
          studentId: student.id,
          obtainedMarks: absent
            ? null
            : new Prisma.Decimal(
                hashMark(`${input.seedPrefix}:${student.id}:${subject.id}`, total),
              ),
          isAbsent: absent,
        },
      });
      markCount += 1;
    }
  }
  return { subjects: usedSubjects, markCount };
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { equals: "tahir", mode: "insensitive" } },
        { name: { contains: "tahir", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, moduleResults: true },
  });
  if (!org) throw new Error("Tahir org not found");

  await prisma.organization.update({
    where: { id: org.id },
    data: { moduleResults: true, moduleStudents: true },
  });

  const klass = await prisma.class.findFirst({
    where: { name: { equals: "Class 9", mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { board: { name: "asc" } },
  });
  if (!klass) throw new Error("Class 9 not found");

  async function ensureSection(name: string) {
    let section = await prisma.section.findFirst({
      where: { organizationId: org.id, classId: klass.id, name },
      select: { id: true, name: true },
    });
    if (!section) {
      section = await prisma.section.create({
        data: { organizationId: org.id, classId: klass.id, name },
        select: { id: true, name: true },
      });
      console.log(`Created section Class 9 / ${name}`);
    }
    return section;
  }

  const sectionA = await ensureSection("A");
  const sectionB = await ensureSection("B");
  const sectionArts = await ensureSection("Arts");

  for (const section of [sectionA, sectionB, sectionArts]) {
    const existing = await prisma.student.findMany({
      where: { organizationId: org.id, sectionId: section.id },
      select: { id: true },
    });
    await wipeSectionStudents(existing.map((s) => s.id));
    console.log(`Cleared ${existing.length} students in Class 9 / ${section.name}`);
  }

  const artsElective = await artsElectiveId(klass.id);
  if (!artsElective) console.warn("No ARTS_ELECTIVE subject found — Arts marks will be commons only");

  async function createScienceStudents(
    sectionId: string,
    tag: string,
  ): Promise<StudentRow[]> {
    const roster = buildScienceRoster(tag, 25);
    const created: StudentRow[] = [];
    for (const row of roster) {
      const electiveSubjectId = await electiveFor(klass.id, row.studyGroup);
      const student = await prisma.student.create({
        data: {
          organizationId: org.id,
          sectionId,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName,
          phone: row.phone,
          stream: "SCIENCE",
          studyGroup: row.studyGroup,
          electiveSubjectId,
          monthlyFee: "4500.00",
          isActive: true,
          ...(electiveSubjectId
            ? { electiveChoices: { create: { subjectId: electiveSubjectId } } }
            : {}),
        },
        select: {
          id: true,
          rollNumber: true,
          stream: true,
          studyGroup: true,
          electiveSubjectId: true,
          electiveChoices: { select: { subjectId: true } },
        },
      });
      created.push(student);
    }
    return created;
  }

  async function createArtsStudents(sectionId: string): Promise<StudentRow[]> {
    const roster = buildArtsRoster(25);
    const created: StudentRow[] = [];
    for (const row of roster) {
      const student = await prisma.student.create({
        data: {
          organizationId: org.id,
          sectionId,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName,
          phone: row.phone,
          stream: "ARTS",
          studyGroup: "ARTS",
          electiveSubjectId: artsElective?.id ?? null,
          monthlyFee: "4000.00",
          isActive: true,
          ...(artsElective
            ? { electiveChoices: { create: { subjectId: artsElective.id } } }
            : {}),
        },
        select: {
          id: true,
          rollNumber: true,
          stream: true,
          studyGroup: true,
          electiveSubjectId: true,
          electiveChoices: { select: { subjectId: true } },
        },
      });
      created.push(student);
    }
    return created;
  }

  const studentsA = await createScienceStudents(sectionA.id, "9A");
  const studentsB = await createScienceStudents(sectionB.id, "9B");
  const studentsArts = await createArtsStudents(sectionArts.id);

  console.log(
    `Seeded A=${studentsA.length} (Bio ${studentsA.filter((s) => s.studyGroup === "BIOLOGY").length} / Comp ${studentsA.filter((s) => s.studyGroup === "COMPUTER").length})`,
  );
  console.log(
    `Seeded B=${studentsB.length} (Bio ${studentsB.filter((s) => s.studyGroup === "BIOLOGY").length} / Comp ${studentsB.filter((s) => s.studyGroup === "COMPUTER").length})`,
  );
  console.log(
    `Seeded Arts=${studentsArts.length} (all ARTS${artsElective ? `, elective=${artsElective.name}` : ""})`,
  );

  const session = academicSession();
  const seriesName = "UAT Term Series";

  const series = await prisma.resultSeries.upsert({
    where: {
      organizationId_name_session: {
        organizationId: org.id,
        name: seriesName,
        session,
      },
    },
    update: { passPercent: 33 },
    create: {
      organizationId: org.id,
      name: seriesName,
      session,
      passPercent: 33,
    },
    select: { id: true, name: true, session: true },
  });
  console.log(`Series: ${series.name} (${series.session})`);

  async function ensureRound(order: number) {
    const roundName = `${seriesName} · Round ${order}`;
    let exam = await prisma.examTerm.findFirst({
      where: { organizationId: org.id, seriesId: series.id, roundOrder: order },
      select: { id: true, name: true, roundOrder: true },
    });
    if (!exam) {
      exam = await prisma.examTerm.create({
        data: {
          organizationId: org.id,
          seriesId: series.id,
          name: roundName,
          session,
          passPercent: 33,
          roundOrder: order,
          examDate: new Date(),
        },
        select: { id: true, name: true, roundOrder: true },
      });
      console.log(`Created ${exam.name}`);
    } else {
      console.log(`Using ${exam.name}`);
    }
    return exam;
  }

  const round1 = await ensureRound(1);
  const round2 = await ensureRound(2);

  // Also keep a standalone mid-term without ethics for single-exam combine tests
  const midName = "UAT Mid Term";
  let midExam = await prisma.examTerm.findFirst({
    where: { organizationId: org.id, name: midName, session },
    select: { id: true, name: true },
  });
  if (!midExam) {
    midExam = await prisma.examTerm.create({
      data: {
        organizationId: org.id,
        name: midName,
        session,
        examDate: new Date(),
        passPercent: 33,
      },
      select: { id: true, name: true },
    });
  }

  for (const exam of [round1, round2, midExam]) {
    for (const [section, students, mode, prefix] of [
      [sectionA, studentsA, "SCIENCE", "A"],
      [sectionB, studentsB, "SCIENCE", "B"],
      [sectionArts, studentsArts, "ARTS", "ARTS"],
    ] as const) {
      const marks = await seedExamMarks({
        organizationId: org.id,
        examTermId: exam.id,
        sectionId: section.id,
        classId: klass.id,
        students,
        mode,
        seedPrefix: `${prefix}-${exam.name}`,
      });
      console.log(
        `${section.name} · ${exam.name}: ${marks.markCount} marks · ${marks.subjects.join(", ")}`,
      );
      if (marks.subjects.some(isEthicsSubjectName)) {
        throw new Error(`Ethics leaked into ${section.name} / ${exam.name}`);
      }
    }
  }

  // Strip any leftover Ethics assessments on these sections (old Mid Term runs)
  const ethicsSubjects = await prisma.subject.findMany({
    where: {
      classId: klass.id,
      OR: [
        { name: { contains: "اخلاقیات" } },
        { name: { contains: "Ethics", mode: "insensitive" } },
        { name: { contains: "akhlaq", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (ethicsSubjects.length) {
    const ethicsIds = ethicsSubjects.map((s) => s.id);
    const oldEthics = await prisma.subjectAssessment.findMany({
      where: {
        organizationId: org.id,
        sectionId: { in: [sectionA.id, sectionB.id, sectionArts.id] },
        subjectId: { in: ethicsIds },
      },
      select: { id: true },
    });
    const ids = oldEthics.map((a) => a.id);
    if (ids.length) {
      await prisma.studentMark.deleteMany({ where: { assessmentId: { in: ids } } });
      await prisma.assessmentManualMark.deleteMany({ where: { assessmentId: { in: ids } } });
      await prisma.assessmentSheet.deleteMany({ where: { assessmentId: { in: ids } } });
      await prisma.subjectAssessment.deleteMany({ where: { id: { in: ids } } });
      console.log(`Removed ${ids.length} Ethics assessments from A/B/Arts`);
    }
  }

  // ---- Tests ----
  const failures: string[] = [];
  const exam = round1;

  for (const [label, sectionId, expected] of [
    ["A", sectionA.id, 25],
    ["B", sectionB.id, 25],
    ["Arts", sectionArts.id, 25],
  ] as const) {
    const count = await prisma.student.count({
      where: { organizationId: org.id, sectionId, isActive: true },
    });
    if (count !== expected) failures.push(`${label} count ${count} != ${expected}`);
  }

  const artsLeak = await prisma.student.count({
    where: {
      organizationId: org.id,
      sectionId: { in: [sectionA.id, sectionB.id] },
      studyGroup: "ARTS",
    },
  });
  if (artsLeak) failures.push(`Arts students leaked into A/B: ${artsLeak}`);

  const scienceInArts = await prisma.student.count({
    where: {
      organizationId: org.id,
      sectionId: sectionArts.id,
      OR: [{ studyGroup: "BIOLOGY" }, { studyGroup: "COMPUTER" }, { stream: "SCIENCE" }],
    },
  });
  if (scienceInArts) failures.push(`Science students in Arts section: ${scienceInArts}`);

  // Bio student must not have Computer marks; Comp must not have Biology marks
  const bio = studentsA.find((s) => s.studyGroup === "BIOLOGY")!;
  const comp = studentsA.find((s) => s.studyGroup === "COMPUTER")!;
  const bioSub = await prisma.subject.findFirst({
    where: { classId: klass.id, name: { equals: "Biology", mode: "insensitive" } },
  });
  const compSub = await prisma.subject.findFirst({
    where: { classId: klass.id, name: { equals: "Computer", mode: "insensitive" } },
  });
  if (bioSub && compSub) {
    const bioHasComp = await prisma.studentMark.count({
      where: {
        studentId: bio.id,
        assessment: { examTermId: exam.id, subjectId: compSub.id },
      },
    });
    const compHasBio = await prisma.studentMark.count({
      where: {
        studentId: comp.id,
        assessment: { examTermId: exam.id, subjectId: bioSub.id },
      },
    });
    const bioHasBio = await prisma.studentMark.count({
      where: {
        studentId: bio.id,
        assessment: { examTermId: exam.id, subjectId: bioSub.id },
      },
    });
    if (bioHasComp) failures.push("Biology student has Computer marks");
    if (compHasBio) failures.push("Computer student has Biology marks");
    if (!bioHasBio) failures.push("Biology student missing Biology marks");
  }

  // Ethics must not appear on science section assessments
  const ethicsOnScience = await prisma.subjectAssessment.count({
    where: {
      organizationId: org.id,
      sectionId: { in: [sectionA.id, sectionB.id] },
      examTermId: { in: [round1.id, round2.id, midExam.id] },
      subject: {
        OR: [
          { name: { contains: "اخلاقیات" } },
          { name: { contains: "Ethics", mode: "insensitive" } },
        ],
      },
    },
  });
  if (ethicsOnScience) {
    failures.push(`Ethics still on Science sections: ${ethicsOnScience}`);
  } else {
    console.log("OK: no Ethics on Science A/B assessments");
  }

  // Series has 2 rounds
  const roundCount = await prisma.examTerm.count({
    where: { organizationId: org.id, seriesId: series.id },
  });
  if (roundCount < 2) failures.push(`Series rounds ${roundCount} < 2`);

  // Both rounds have marks on section A
  for (const round of [round1, round2]) {
    const marks = await prisma.studentMark.count({
      where: {
        assessment: {
          organizationId: org.id,
          examTermId: round.id,
          sectionId: sectionA.id,
        },
      },
    });
    if (marks < 25) failures.push(`${round.name} section A marks too low: ${marks}`);
  }

  if (failures.length) {
    console.log("\n--- Tests ---");
    for (const f of failures) console.error("FAIL", f);
    process.exitCode = 1;
  } else {
    console.log("\n--- Tests ---");
    console.log("PASSED: rosters · no Ethics on Bio/Comp · Round1+Round2 marks");
  }

  console.log(`\nSeries combined: /org-admin/results/sections/${sectionA.id}/series/${series.id}/combined`);
  console.log(
    `Sections combine: /org-admin/results/classes/${klass.id}/combine?sections=${sectionA.id},${sectionB.id}&examId=${round1.id}&stream=SCIENCE`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
