import { notFound } from "next/navigation";
import { PageHeader, PageStack } from "@/components/page-header";
import { requireRole } from "@/lib/rbac";
import { getQuestionForEdit } from "../../actions";
import { EditQuestionForm } from "./edit-question-form";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const { id } = await params;

  let question;
  try {
    question = await getQuestionForEdit(id);
  } catch {
    notFound();
  }

  const path = [
    question.topic.chapter.subject.class.board.name,
    question.topic.chapter.subject.class.name,
    question.topic.chapter.subject.name,
    question.topic.chapter.name,
    question.topic.name,
  ].join(" → ");

  return (
    <PageStack>
      <PageHeader kicker="Question bank" title="Edit question" description={path} />
      <EditQuestionForm
        question={{
          id: question.id,
          type: question.type,
          text: question.text,
          textUrdu: question.textUrdu,
          marks: question.marks,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctAnswer: question.correctAnswer,
          source: question.source,
          topicId: question.topicId,
          path,
        }}
      />
    </PageStack>
  );
}
