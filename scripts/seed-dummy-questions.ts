import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import type { Prisma } from "../src/generated/prisma/client";

type ChapterSpec = { title: string; topics: string[] };

const CHAPTER_BANK: Record<string, ChapterSpec[]> = {
  Physics: [
    {
      title: "Measurements and Units",
      topics: ["Physical Quantities", "Measuring Instruments"],
    },
    {
      title: "Kinematics",
      topics: ["Types of Motion", "Equations of Motion"],
    },
    {
      title: "Dynamics",
      topics: ["Newton's Laws", "Force and Momentum"],
    },
    {
      title: "Work Energy and Power",
      topics: ["Work and Energy", "Power and Efficiency"],
    },
  ],
  Chemistry: [
    {
      title: "Fundamentals of Chemistry",
      topics: ["Matter and its States", "Atoms and Molecules"],
    },
    {
      title: "Atomic Structure",
      topics: ["Subatomic Particles", "Electronic Configuration"],
    },
    {
      title: "Chemical Bonding",
      topics: ["Ionic Bonding", "Covalent Bonding"],
    },
    {
      title: "Acids Bases and Salts",
      topics: ["Properties of Acids and Bases", "pH and Indicators"],
    },
  ],
  Biology: [
    {
      title: "Introduction to Biology",
      topics: ["Branches of Biology", "Levels of Organization"],
    },
    {
      title: "Cell Biology",
      topics: ["Cell Structure", "Cell Division"],
    },
    {
      title: "Plant Physiology",
      topics: ["Photosynthesis", "Transport in Plants"],
    },
    {
      title: "Human Physiology",
      topics: ["Digestive System", "Circulatory System"],
    },
  ],
  Mathematics: [
    {
      title: "Number Systems",
      topics: ["Real Numbers", "Exponents and Radicals"],
    },
    {
      title: "Algebra",
      topics: ["Linear Equations", "Quadratic Equations"],
    },
    {
      title: "Geometry",
      topics: ["Triangles", "Circles"],
    },
    {
      title: "Statistics and Probability",
      topics: ["Data Representation", "Basic Probability"],
    },
  ],
  English: [
    {
      title: "Grammar Essentials",
      topics: ["Parts of Speech", "Tenses"],
    },
    {
      title: "Vocabulary and Usage",
      topics: ["Synonyms and Antonyms", "Idioms and Phrases"],
    },
    {
      title: "Reading Comprehension",
      topics: ["Main Idea", "Inference Skills"],
    },
    {
      title: "Writing Skills",
      topics: ["Paragraph Writing", "Essay Writing"],
    },
  ],
  Urdu: [
    {
      title: "قواعد",
      topics: ["اسم اور فعل", "جملے کی اقسام"],
    },
    {
      title: "ادب",
      topics: ["غزل", "نظم"],
    },
    {
      title: "نثر",
      topics: ["مضمون نویسی", "خلاصہ نویسی"],
    },
    {
      title: "مشاہیر",
      topics: ["علامہ اقبال", "میر تقی میر"],
    },
  ],
  Islamiyat: [
    {
      title: "عقائد",
      topics: ["توحید", "رسالت"],
    },
    {
      title: "عبادات",
      topics: ["نماز", "زکوٰۃ"],
    },
    {
      title: "سیرت",
      topics: ["مکی زندگی", "مدنی زندگی"],
    },
    {
      title: "اخلاق",
      topics: ["صدق", "امانت"],
    },
  ],
  Computer: [
    {
      title: "Introduction to Computers",
      topics: ["Hardware and Software", "Input and Output Devices"],
    },
    {
      title: "Operating Systems",
      topics: ["OS Basics", "File Management"],
    },
    {
      title: "Networks and Internet",
      topics: ["Network Types", "Internet Services"],
    },
    {
      title: "Programming Basics",
      topics: ["Algorithms", "Flowcharts"],
    },
  ],
  Science: [
    {
      title: "Living Things",
      topics: ["Plants and Animals", "Habitats"],
    },
    {
      title: "Matter and Materials",
      topics: ["States of Matter", "Properties of Materials"],
    },
    {
      title: "Forces and Energy",
      topics: ["Pushes and Pulls", "Light and Sound"],
    },
    {
      title: "Earth and Space",
      topics: ["Our Planet", "Sun Moon and Stars"],
    },
  ],
  "Social Studies": [
    {
      title: "Our Community",
      topics: ["Family and Neighbourhood", "Community Helpers"],
    },
    {
      title: "Geography Basics",
      topics: ["Maps and Directions", "Landforms"],
    },
    {
      title: "History and Culture",
      topics: ["Local History", "Festivals and Traditions"],
    },
    {
      title: "Citizenship",
      topics: ["Rights and Responsibilities", "Environment Care"],
    },
  ],
};

function defaultChapters(subjectName: string): ChapterSpec[] {
  return [
    {
      title: `Introduction to ${subjectName}`,
      topics: [`Basics of ${subjectName}`, `Key Concepts in ${subjectName}`],
    },
    {
      title: `${subjectName} Fundamentals`,
      topics: [`Core Ideas`, `Practice Skills`],
    },
    {
      title: `${subjectName} Applications`,
      topics: [`Real-life Uses`, `Problem Solving`],
    },
    {
      title: `${subjectName} Review`,
      topics: [`Summary Topics`, `Assessment Practice`],
    },
  ];
}

function marksFor(type: "MCQ" | "SHORT" | "LONG") {
  if (type === "MCQ") return 1;
  if (type === "SHORT") return 2;
  return 5;
}

function buildRows(
  topicId: string,
  prefix: string,
  subjectName: string,
  chapterTitle: string,
  topicTitle: string,
  chapterNo: number,
  topicNo: number,
): Prisma.QuestionCreateManyInput[] {
  const rows: Prisma.QuestionCreateManyInput[] = [];
  const answers = ["A", "B", "C", "D"] as const;

  for (let n = 1; n <= 3; n++) {
    rows.push({
      type: "MCQ",
      text: `(Dummy) Which statement best relates to ${topicTitle}? [Q${n}]`,
      optionA: `Option A about ${topicTitle}`,
      optionB: `Option B about ${topicTitle}`,
      optionC: `Option C about ${topicTitle}`,
      optionD: `Option D about ${topicTitle}`,
      correctAnswer: answers[(n - 1) % 4],
      marks: marksFor("MCQ"),
      source: "Dummy Seed",
      externalKey: `${prefix}:ch${chapterNo}:t${topicNo}:MCQ:${n}`,
      topicId,
      isActive: true,
    });
  }

  const shorts = [
    `Define ${topicTitle} in your own words.`,
    `Write two important points about ${topicTitle}.`,
    `Give one example related to ${topicTitle}.`,
  ];
  for (const [i, text] of shorts.entries()) {
    rows.push({
      type: "SHORT",
      text,
      marks: marksFor("SHORT"),
      source: "Dummy Seed",
      externalKey: `${prefix}:ch${chapterNo}:t${topicNo}:SHORT:${i + 1}`,
      topicId,
      isActive: true,
    });
  }

  const longs = [
    `Explain ${topicTitle} in detail with examples from ${chapterTitle}.`,
    `Discuss the importance of ${topicTitle} in ${subjectName} (chapter ${chapterNo}.${topicNo}).`,
  ];
  for (const [i, text] of longs.entries()) {
    rows.push({
      type: "LONG",
      text,
      marks: marksFor("LONG"),
      source: "Dummy Seed",
      externalKey: `${prefix}:ch${chapterNo}:t${topicNo}:LONG:${i + 1}`,
      topicId,
      isActive: true,
    });
  }

  return rows;
}

async function main() {
  const subjects = await prisma.subject.findMany({
    include: {
      class: { include: { board: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  const existingKeys = new Set(
    (
      await prisma.question.findMany({
        where: { externalKey: { startsWith: "dummy:v2:" } },
        select: { externalKey: true },
      })
    )
      .map((q) => q.externalKey)
      .filter((k): k is string => Boolean(k)),
  );

  const realSubjectIds = new Set(
    (
      await prisma.question.findMany({
        where: { externalKey: { startsWith: "lahore:" } },
        select: { topic: { select: { chapter: { select: { subjectId: true } } } } },
      })
    ).map((q) => q.topic.chapter.subjectId),
  );

  let subjectsSkippedReal = 0;
  let subjectsSeeded = 0;
  let chaptersCreated = 0;
  let topicsCreated = 0;
  let questionsCreated = 0;
  const pending: Prisma.QuestionCreateManyInput[] = [];

  for (const subject of subjects) {
    if (realSubjectIds.has(subject.id)) {
      subjectsSkippedReal += 1;
      continue;
    }

    const chapterSpecs =
      CHAPTER_BANK[subject.name] ?? defaultChapters(subject.name);
    const prefix = `dummy:v2:${subject.class.board.name}:${subject.class.name}:${subject.name}`;
    subjectsSeeded += 1;

    for (const [cIdx, chapterSpec] of chapterSpecs.entries()) {
      const chapterNo = cIdx + 1;
      const chapterName = `${chapterNo}. ${chapterSpec.title}`;
      const before = await prisma.chapter.findUnique({
        where: {
          subjectId_name: { subjectId: subject.id, name: chapterName },
        },
      });
      const chapter = await prisma.chapter.upsert({
        where: {
          subjectId_name: { subjectId: subject.id, name: chapterName },
        },
        update: { order: chapterNo },
        create: {
          subjectId: subject.id,
          name: chapterName,
          order: chapterNo,
        },
      });
      if (!before) chaptersCreated += 1;

      for (const [tIdx, topicTitle] of chapterSpec.topics.entries()) {
        const topicNo = tIdx + 1;
        const topicName = `${chapterNo}.${topicNo} ${topicTitle}`;
        const beforeTopic = await prisma.topic.findUnique({
          where: {
            chapterId_name: { chapterId: chapter.id, name: topicName },
          },
        });
        const topic = await prisma.topic.upsert({
          where: {
            chapterId_name: { chapterId: chapter.id, name: topicName },
          },
          update: { order: topicNo },
          create: {
            chapterId: chapter.id,
            name: topicName,
            order: topicNo,
          },
        });
        if (!beforeTopic) topicsCreated += 1;

        for (const row of buildRows(
          topic.id,
          prefix,
          subject.name,
          chapterSpec.title,
          topicTitle,
          chapterNo,
          topicNo,
        )) {
          if (!row.externalKey || existingKeys.has(row.externalKey)) continue;
          pending.push(row);
          existingKeys.add(row.externalKey);
        }
      }
    }
  }

  const CHUNK = 200;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    const result = await prisma.question.createMany({ data: chunk });
    questionsCreated += result.count;
    if ((i / CHUNK) % 10 === 0) {
      console.log(`Inserted ${Math.min(i + CHUNK, pending.length)} / ${pending.length}`);
    }
  }

  const byType = await prisma.question.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  console.log("Dummy curriculum seed complete");
  console.log({
    subjectsSkippedReal,
    subjectsSeeded,
    chaptersCreated,
    topicsCreated,
    questionsCreated,
    pendingPlanned: pending.length,
    totalsByType: Object.fromEntries(
      byType.map((row) => [row.type, row._count._all]),
    ),
    totalQuestions: await prisma.question.count(),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
