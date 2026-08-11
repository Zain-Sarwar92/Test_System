import Link from "next/link";
import { BookPlus } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import { requireRole } from "@/lib/rbac";
import { QuestionBankTable } from "./question-bank-table";

export default async function QuestionBankListPage() {
  await requireRole(["SUPER_ADMIN"]);

  return (
    <PageStack>
      <PageHeader
        kicker="Global bank"
        title="Question bank"
        description="Browse, search, edit, and deactivate questions across all topics."
        actions={
          <Link href="/super-admin/questions">
            <Button>
              <BookPlus className="h-4 w-4" />
              Add question
            </Button>
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <QuestionBankTable />
      </Suspense>
    </PageStack>
  );
}
