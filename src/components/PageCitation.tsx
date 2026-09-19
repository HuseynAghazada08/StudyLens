"use client";

import { cn } from "@/lib/utils";

/**
 * Clickable page reference. Clicking scrolls the notes/summary tab's
 * section for that page into view via the `section-page-N` anchors that
 * the workspace renders for each section.
 */
export function PageCitation({
  pages,
  onNavigate,
  className,
}: {
  pages: number[];
  onNavigate?: (page: number) => void;
  className?: string;
}) {
  if (!pages?.length) return null;
  const unique = [...new Set(pages)].sort((a, b) => a - b);
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {unique.map((p) => (
        <button
          key={p}
          onClick={() => onNavigate?.(p)}
          title={`Jump to page ${p}`}
          className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
        >
          p.{p}
        </button>
      ))}
    </span>
  );
}
