/**
 * Remove previous Lahore Class 10 English bank questions before re-import.
 * Keeps chapters/topics; only deletes questions under that subject.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const subject = await prisma.subject.findFirst({
    where: {
      name: "English",
      class: { name: "Class 10", board: { name: "Lahore Board" } },
    },
    include: { chapters: { include: { topics: true } } },
  });
  if (!subject) {
    console.log("No Lahore Class 10 English subject — nothing to clean");
    return;
  }
  const topicIds = subject.chapters.flatMap((c) => c.topics.map((t) => t.id));
  const before = await prisma.question.count({
    where: { topicId: { in: topicIds } },
  });

  // Detach suggestions that point at these questions so deletes succeed
  await prisma.questionSuggestion.updateMany({
    where: { question: { topicId: { in: topicIds } } },
    data: { questionId: null },
  });

  // Remove test links then questions
  await prisma.testQuestion.deleteMany({
    where: { question: { topicId: { in: topicIds } } },
  });
  const deleted = await prisma.question.deleteMany({
    where: { topicId: { in: topicIds } },
  });

  console.log({
    subjectId: subject.id,
    topics: topicIds.length,
    before,
    deleted: deleted.count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
