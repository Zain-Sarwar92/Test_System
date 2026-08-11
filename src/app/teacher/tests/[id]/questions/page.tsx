import { redirect } from "next/navigation";

/** Old editor URL → paper preview (Edit Questions is a popup there). */
export default async function TeacherTestQuestionsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/teacher/tests/${id}`);
}
