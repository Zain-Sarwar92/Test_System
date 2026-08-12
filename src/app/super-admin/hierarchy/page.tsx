import { PageHeader, PageStack } from "@/components/page-header";
import { loadCurriculumStructure } from "@/lib/curriculum-tree";
import { HierarchyManager } from "./hierarchy-manager";

export default async function HierarchyPage() {
  const boards = await loadCurriculumStructure({ withQuestionCounts: true });

  return (
    <PageStack>
      <PageHeader
        kicker="Curriculum"
        title="Board → Topic hierarchy"
        description="Manage boards, classes, subjects, chapters, and topics used across the global question bank."
      />
      <HierarchyManager boards={boards} />
    </PageStack>
  );
}
