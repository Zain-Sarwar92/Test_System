import { ORG_MODULE_KEYS, ORG_MODULES, type OrgModuleFlags } from "@/lib/org-module-catalog";

export function OrgModuleCheckboxes({
  values,
}: {
  values?: Partial<OrgModuleFlags>;
}) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-[rgba(15,40,70,0.12)] bg-[#f7fafc] px-4 py-3">
      <legend className="px-1 text-sm font-semibold text-ink">Optional modules</legend>
      <p className="text-xs text-muted">
        New organizations start with these off. Enable only the add-ons this school has purchased.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ORG_MODULE_KEYS.map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-2 rounded-lg bg-card px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="module"
              value={key}
              defaultChecked={Boolean(values?.[key])}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-ink">{ORG_MODULES[key].label}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {ORG_MODULES[key].description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
