import { redirect } from "next/navigation";

export default function LegacyFeeDuesRedirect() {
  redirect("/org-admin/fees/pending");
}
