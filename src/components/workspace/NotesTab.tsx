"use client";

import { Badge, Card } from "@/components/ui";
import { PageCitation } from "@/components/PageCitation";
import { formatPageRange } from "@/lib/utils";
import type { StudyMaterial } from "@/lib/types";

/**
 * Section-by-section notes. Each card carries a data-page-range attribute so
 * page citations elsewhere can scroll to and highlight the right section.
 */
export function NotesTab({
  material,
  onNavigate,
}: {
  material: StudyMaterial;
  onNavigate: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Notes are organized by section. Click any citation to compare these notes
        with the original extracted source page.
      </p>
      {material.sectionNotes.map((s, i) => (
        <Card
          key={i}
          data-page-range={`${s.pageStart}-${s.pageEnd}`}
          className="scroll-mt-6 p-6 transition-shadow"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{s.heading}</h3>
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{formatPageRange(s.pageStart, s.pageEnd)}</Badge>
              <PageCitation pages={[s.pageStart]} onNavigate={onNavigate} />
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {s.bullets.map((b, j) => (
              <li
                key={j}
                className="flex gap-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300"
              >
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                  aria-hidden
                />
                {b}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
