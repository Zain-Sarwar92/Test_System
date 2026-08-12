import { CalendarClock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { TeacherScheduleFormView } from "./teacher-schedule-form-view";
import { getMyAssignedTestSchedules } from "./actions";

export default async function TeacherSchedulesPage() {
  const schedules = await getMyAssignedTestSchedules();

  const openCount = schedules.filter((item) => item.status !== "COMPLETED").length;

  return (
    <PageStack wide>
      <PageHeader
        kicker="Assignments"
        title="My Assigned Tests"
        description="Papers due within 1 week show as pending here. Email reminder goes only 1 day before if the paper is still missing."
      />

      {schedules.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4e5] text-[#8a5a00]">
            <CalendarClock className="h-7 w-7" />
          </div>
          <div>
            <CardTitle>No assigned tests</CardTitle>
            <p className="mt-1 text-sm text-muted">
              When your org admin schedules a test for you, it will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="chart-card py-3.5 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-xs">
                Total
              </p>
              <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
                {schedules.length}
              </p>
            </Card>
            <Card className="chart-card py-3.5 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-xs">
                Needs action
              </p>
              <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{openCount}</p>
            </Card>
            <Card className="chart-card py-3.5 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-xs">
                Completed
              </p>
              <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
                {schedules.length - openCount}
              </p>
            </Card>
          </div>

          <TeacherScheduleFormView schedules={schedules} />
        </>
      )}
    </PageStack>
  );
}
