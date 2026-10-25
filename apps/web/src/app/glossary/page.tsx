import type { Metadata } from "next";
import { GlossaryView } from "@/components/glossary-view";

export const metadata: Metadata = { title: "Glossary" };

export default function GlossaryPage() {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="h1">Glossary</h1>
          <p className="lede">
            Every term used in a report, with five answers: what it means in plain words, what it
            means technically, why it matters, how it is calculated and how to improve it.
          </p>
        </div>
      </header>
      <GlossaryView />
    </div>
  );
}
