import { prisma } from "@/lib/prisma";
import { teacherAssignmentScopeKey } from "@/lib/teacher-assignments";

export type CurriculumTopicPayload = {
  id: string;
  name: string;
  order: number;
  questionCount: number;
  countsByType: { MCQ: number; SHORT: number; LONG: number };
};

export type CurriculumBoardPayload = {
  id: string;
  name: string;
  classes: Array<{
    id: string;
    name: string;
    subjects: Array<{
      id: string;
      name: string;
      chapters: Array<{
        id: string;
        name: string;
        order: number;
        topics: CurriculumTopicPayload[];
      }>;
    }>;
  }>;
};

/**
 * Keep only class/subject pairs the teacher is assigned to teach.
 */
export function filterCurriculumTreeForTeacher(
  boards: CurriculumBoardPayload[],
  allowedClassSubjectKeys: Set<string>,
): CurriculumBoardPayload[] {
  return boards
    .map((board) => ({
      ...board,
      classes: board.classes
        .map((klass) => ({
          ...klass,
          subjects: klass.subjects.filter((subject) =>
            allowedClassSubjectKeys.has(
              teacherAssignmentScopeKey(klass.id, subject.id),
            ),
          ),
        }))
        .filter((klass) => klass.subjects.length > 0),
    }))
    .filter((board) => board.classes.length > 0);
}

/**
 * Load board→class→subject→chapter→topic tree without nested Prisma includes.
 * Deep includes blow SQLite's variable/parameter limit once the bank is large.
 */
export async function loadCurriculumTreeForGenerate(options?: {
  teacherScope?: Set<string>;
}): Promise<CurriculumBoardPayload[]> {
  const [boards, classes, subjects, chapters, topics, questionCounts] =
    await Promise.all([
      prisma.board.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.class.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, boardId: true },
      }),
      prisma.subject.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, classId: true },
      }),
      prisma.chapter.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, order: true, subjectId: true },
      }),
      prisma.topic.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, order: true, chapterId: true },
      }),
      prisma.question.groupBy({
        by: ["topicId", "type"],
        where: { isActive: true },
        _count: { _all: true },
      }),
    ]);

  const countsByTopic = new Map<
    string,
    { MCQ: number; SHORT: number; LONG: number; total: number }
  >();
  for (const row of questionCounts) {
    const current = countsByTopic.get(row.topicId) ?? {
      MCQ: 0,
      SHORT: 0,
      LONG: 0,
      total: 0,
    };
    current[row.type] = row._count._all;
    current.total += row._count._all;
    countsByTopic.set(row.topicId, current);
  }

  const topicsByChapter = new Map<string, CurriculumTopicPayload[]>();
  for (const topic of topics) {
    const counts = countsByTopic.get(topic.id);
    const list = topicsByChapter.get(topic.chapterId) ?? [];
    list.push({
      id: topic.id,
      name: topic.name,
      order: topic.order,
      questionCount: counts?.total ?? 0,
      countsByType: {
        MCQ: counts?.MCQ ?? 0,
        SHORT: counts?.SHORT ?? 0,
        LONG: counts?.LONG ?? 0,
      },
    });
    topicsByChapter.set(topic.chapterId, list);
  }

  const chaptersBySubject = new Map<
    string,
    Array<{
      id: string;
      name: string;
      order: number;
      topics: CurriculumTopicPayload[];
    }>
  >();
  for (const chapter of chapters) {
    const list = chaptersBySubject.get(chapter.subjectId) ?? [];
    list.push({
      id: chapter.id,
      name: chapter.name,
      order: chapter.order,
      topics: topicsByChapter.get(chapter.id) ?? [],
    });
    chaptersBySubject.set(chapter.subjectId, list);
  }

  const subjectsByClass = new Map<
    string,
    Array<{
      id: string;
      name: string;
      chapters: Array<{
        id: string;
        name: string;
        order: number;
        topics: CurriculumTopicPayload[];
      }>;
    }>
  >();
  for (const subject of subjects) {
    const list = subjectsByClass.get(subject.classId) ?? [];
    list.push({
      id: subject.id,
      name: subject.name,
      chapters: chaptersBySubject.get(subject.id) ?? [],
    });
    subjectsByClass.set(subject.classId, list);
  }

  const classesByBoard = new Map<
    string,
    Array<{
      id: string;
      name: string;
      subjects: Array<{
        id: string;
        name: string;
        chapters: Array<{
          id: string;
          name: string;
          order: number;
          topics: CurriculumTopicPayload[];
        }>;
      }>;
    }>
  >();
  for (const klass of classes) {
    const list = classesByBoard.get(klass.boardId) ?? [];
    list.push({
      id: klass.id,
      name: klass.name,
      subjects: subjectsByClass.get(klass.id) ?? [],
    });
    classesByBoard.set(klass.boardId, list);
  }

  const tree = boards.map((board) => ({
    id: board.id,
    name: board.name,
    classes: [...(classesByBoard.get(board.id) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    ),
  }));

  if (options?.teacherScope) {
    if (options.teacherScope.size === 0) return [];
    return filterCurriculumTreeForTeacher(tree, options.teacherScope);
  }

  return tree;
}

export type CurriculumStructureTopic = {
  id: string;
  name: string;
  order: number;
  questionCount: number;
};

export type CurriculumStructureBoard = {
  id: string;
  name: string;
  classes: Array<{
    id: string;
    name: string;
    subjects: Array<{
      id: string;
      name: string;
      chapters: Array<{
        id: string;
        name: string;
        order: number;
        topics: CurriculumStructureTopic[];
      }>;
    }>;
  }>;
};

/**
 * Flat parallel queries — faster than deep Prisma includes on large banks.
 */
export async function loadCurriculumStructure(options?: {
  withQuestionCounts?: boolean;
}): Promise<CurriculumStructureBoard[]> {
  const withQuestionCounts = options?.withQuestionCounts ?? false;

  const [boards, classes, subjects, chapters, topics, questionCounts] =
    await Promise.all([
      prisma.board.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.class.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, boardId: true },
      }),
      prisma.subject.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, classId: true },
      }),
      prisma.chapter.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, order: true, subjectId: true },
      }),
      prisma.topic.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, order: true, chapterId: true },
      }),
      withQuestionCounts
        ? prisma.question.groupBy({
            by: ["topicId"],
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

  const countsByTopic = new Map<string, number>();
  for (const row of questionCounts) {
    countsByTopic.set(row.topicId, row._count._all);
  }

  const topicsByChapter = new Map<string, CurriculumStructureTopic[]>();
  for (const topic of topics) {
    const list = topicsByChapter.get(topic.chapterId) ?? [];
    list.push({
      id: topic.id,
      name: topic.name,
      order: topic.order,
      questionCount: countsByTopic.get(topic.id) ?? 0,
    });
    topicsByChapter.set(topic.chapterId, list);
  }

  const chaptersBySubject = new Map<
    string,
    Array<{
      id: string;
      name: string;
      order: number;
      topics: CurriculumStructureTopic[];
    }>
  >();
  for (const chapter of chapters) {
    const list = chaptersBySubject.get(chapter.subjectId) ?? [];
    list.push({
      id: chapter.id,
      name: chapter.name,
      order: chapter.order,
      topics: topicsByChapter.get(chapter.id) ?? [],
    });
    chaptersBySubject.set(chapter.subjectId, list);
  }

  const subjectsByClass = new Map<
    string,
    Array<{
      id: string;
      name: string;
      chapters: Array<{
        id: string;
        name: string;
        order: number;
        topics: CurriculumStructureTopic[];
      }>;
    }>
  >();
  for (const subject of subjects) {
    const list = subjectsByClass.get(subject.classId) ?? [];
    list.push({
      id: subject.id,
      name: subject.name,
      chapters: chaptersBySubject.get(subject.id) ?? [],
    });
    subjectsByClass.set(subject.classId, list);
  }

  const classesByBoard = new Map<
    string,
    Array<{
      id: string;
      name: string;
      subjects: Array<{
        id: string;
        name: string;
        chapters: Array<{
          id: string;
          name: string;
          order: number;
          topics: CurriculumStructureTopic[];
        }>;
      }>;
    }>
  >();
  for (const klass of classes) {
    const list = classesByBoard.get(klass.boardId) ?? [];
    list.push({
      id: klass.id,
      name: klass.name,
      subjects: subjectsByClass.get(klass.id) ?? [],
    });
    classesByBoard.set(klass.boardId, list);
  }

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    classes: [...(classesByBoard.get(board.id) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    ),
  }));
}
