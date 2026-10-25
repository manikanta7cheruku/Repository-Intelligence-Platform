import type { ReactNode } from "react";
import { ReportShell } from "@/components/report-shell";

export default async function ReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportShell id={id}>{children}</ReportShell>;
}
