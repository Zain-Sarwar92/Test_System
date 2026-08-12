import { loadCurriculumStructure } from "@/lib/curriculum-tree";
import { AddQuestionForm } from "./add-question-form";

export default async function SuperAdminQuestionsPage() {
  const boards = await loadCurriculumStructure();

  return <AddQuestionForm boards={boards} />;
}
