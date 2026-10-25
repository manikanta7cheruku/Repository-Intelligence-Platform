import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionView } from "@/components/section-view";
import { SECTIONS } from "@/lib/sections";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: SECTIONS.find((s) => s.slug === section)?.label ?? "Report" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.some((s) => s.slug === section)) notFound();
  return (
    <Suspense fallback={<div className="skeleton sk-block" />}>
      <SectionView slug={section} />
    </Suspense>
  );
}
