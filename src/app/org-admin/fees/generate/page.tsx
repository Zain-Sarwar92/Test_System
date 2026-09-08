import { redirect } from "next/navigation";

export default function LegacyFeeGenerateRedirect() {
  redirect("/org-admin/fees");
}
