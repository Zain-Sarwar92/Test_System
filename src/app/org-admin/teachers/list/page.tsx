import { redirect } from "next/navigation";

export default function TeachersListRedirectPage() {
  redirect("/org-admin/teachers");
}
