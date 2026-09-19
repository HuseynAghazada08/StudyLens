"use client";

import { Lightbulb, Timer } from "lucide-react";
import { Badge, Card, Collapsible } from "@/components/ui";
import { PageCitation } from "@/components/PageCitation";
import { formatPageRange } from "@/lib/utils";
import type { StudyMaterial } from "@/lib/types";

export function SummaryTab({
  material,
  onNavigate,
}: {
  material: StudyMaterial;
  onNavigate: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="border-indigo-200 bg-indigo-50/50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
          <Timer className="h-4 w-4" aria-hidden />
          One-minute summary
        </div>
        <p className="leading-relaxed">{material.oneMinuteSummary}</p>
        <PageCitation className="mt-3" pages={material.summaryPages} onNavigate={onNavigate} />
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 font-semibold">Detailed summary</h3>
        <PageCitation className="mb-3" pages={material.summaryPages} onNavigate={onNavigate} />
        <div className="flex flex-col gap-3 text-stone-600 dark:text-stone-300">
          {material.detailedSummary.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      </Card>

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
          Key concepts
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {material.keyConcepts.map((c, i) => (
            <Card key={i} className="p-5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium">{c.name}</p>
                <PageCitation pages={c.pages} onNavigate={onNavigate} />
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {c.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-semibold">Key terms</h3>
        {!material.keyTerms.length && <p className="text-sm text-stone-500">No explicit definitions were detected in this document. Review the section notes for the main ideas.</p>}
        <Card className="divide-y divide-stone-100 dark:divide-stone-800">
          {material.keyTerms.map((t, i) => (
            <div key={i} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-4">
              <span className="w-48 shrink-0 font-medium">{t.term}</span>
              <span className="flex-1 text-sm text-stone-600 dark:text-stone-300">
                {t.definition}
              </span>
              <PageCitation pages={t.pages} onNavigate={onNavigate} />
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h3 className="mb-3 font-semibold">Section summaries</h3>
        <div className="flex flex-col gap-3">
          {material.sectionSummaries.map((s, i) => (
            <Collapsible
              key={i}
              title={s.heading}
              meta={
                <Badge tone="neutral">
                  {formatPageRange(s.pageStart, s.pageEnd)}
                </Badge>
              }
              defaultOpen={i === 0}
            >
              <p className="mb-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                {s.summary}
              </p>
              <PageCitation
                pages={[s.pageStart, s.pageEnd]}
                onNavigate={onNavigate}
              />
            </Collapsible>
          ))}
        </div>
      </section>
    </div>
  );
}
