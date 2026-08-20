import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { requireRole } from "@/lib/rbac";
import { getSystemSettings } from "@/lib/system-settings";
import { saveSystemSettings } from "./actions";

export default async function SettingsPage() {
  await requireRole(["SUPER_ADMIN"]);
  const settings = await getSystemSettings();

  return (
    <PageStack>
      <PageHeader
        kicker="Platform"
        title="System settings"
        description="Defaults used when teachers generate tests and platform-wide options."
      />

      <Card className="chart-card max-w-2xl">
        <CardTitle>Defaults &amp; maintenance</CardTitle>
        <CardDescription className="mt-1">
          Changes apply to new tests; existing saved tests are unchanged.
        </CardDescription>

        <form action={saveSystemSettings} className="mt-4 space-y-4">
          <label className="block">
            <span className="field-label">Platform name</span>
            <Input
              name="platformName"
              defaultValue={settings.platform_name}
              required
              className="mt-1"
            />
          </label>

          <div className="form-grid form-grid-2">
            <label>
              <span className="field-label">Default duration (min)</span>
              <Input
                name="defaultDurationMinutes"
                type="number"
                min={5}
                defaultValue={settings.default_duration_minutes}
                className="mt-1"
              />
            </label>
            <label>
              <span className="field-label">Maintenance mode</span>
              <select
                name="maintenanceMode"
                defaultValue={settings.maintenance_mode}
                className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
              >
                <option value="false">Off</option>
                <option value="true">On</option>
              </select>
            </label>
          </div>

          <div className="form-grid form-grid-3">
            <label>
              <span className="field-label">Default MCQ marks</span>
              <Input
                name="defaultMcqMarks"
                type="number"
                min={1}
                defaultValue={settings.default_mcq_marks}
                className="mt-1"
              />
            </label>
            <label>
              <span className="field-label">Default short marks</span>
              <Input
                name="defaultShortMarks"
                type="number"
                min={1}
                defaultValue={settings.default_short_marks}
                className="mt-1"
              />
            </label>
            <label>
              <span className="field-label">Default long marks</span>
              <Input
                name="defaultLongMarks"
                type="number"
                min={1}
                defaultValue={settings.default_long_marks}
                className="mt-1"
              />
            </label>
          </div>

          <Button type="submit">Save settings</Button>
        </form>
      </Card>
    </PageStack>
  );
}
