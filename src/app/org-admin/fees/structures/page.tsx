import { redirect } from "next/navigation";

/** Legacy structures URL → fee types settings. */
export default function LegacyFeeStructuresRedirect() {
  redirect("/org-admin/fees/types");
}
