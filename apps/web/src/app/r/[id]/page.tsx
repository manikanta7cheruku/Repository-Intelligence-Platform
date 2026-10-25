import { redirect } from "next/navigation";

export default async function ReportIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/r/${id}/briefing`);
}
