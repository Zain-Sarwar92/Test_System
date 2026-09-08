import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ period?: string; feeName?: string }>;
};

/** Legacy path → stable query-param print route. */
export default async function LegacyPendingFeesPrintRedirect({
  params,
  searchParams,
}: Props) {
  const { sectionId } = await params;
  const filters = await searchParams;
  const qs = new URLSearchParams({
    sectionId,
    ...(filters.period ? { period: filters.period } : {}),
    ...(filters.feeName ? { feeName: filters.feeName } : {}),
  });
  redirect(`/org-admin/fees/pending-print?${qs.toString()}`);
}
