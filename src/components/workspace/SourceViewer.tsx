"use client";

import { useEffect, useRef } from "react";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import type { PageText } from "@/lib/types";

export function SourceViewer({ page, pages, onPage, onClose }: { page: number | null; pages: PageText[]; onPage: (page: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (page !== null && !dialog.current?.open) dialog.current?.showModal();
    if (page === null) dialog.current?.close();
  }, [page]);
  const index = pages.findIndex(p => p.page === page);
  return (
    <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="source-title" className="fixed inset-0 m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-2xl overflow-hidden rounded-3xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
      <div className="flex items-center justify-between border-b border-stone-200 p-5 dark:border-stone-700">
        <div><h2 id="source-title" className="font-semibold">Source · Page {page}</h2><p className="mt-1 text-xs text-stone-500">Extracted PDF text · not an AI summary</p></div>
        <Button variant="ghost" onClick={onClose} aria-label="Close source"><X className="h-5 w-5" /></Button>
      </div>
      <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap p-6 text-sm leading-8">{pages[index]?.text || "This page contains no extractable text."}</div>
      <div className="flex items-center justify-between border-t border-stone-200 p-4 dark:border-stone-700">
        <Button variant="secondary" disabled={index <= 0} onClick={() => onPage(pages[index - 1].page)}><ArrowLeft className="h-4 w-4" />Previous</Button>
        <span className="text-xs text-stone-500">{page} / {pages.length}</span>
        <Button variant="secondary" disabled={index < 0 || index >= pages.length - 1} onClick={() => onPage(pages[index + 1].page)}>Next<ArrowRight className="h-4 w-4" /></Button>
      </div>
    </dialog>
  );
}
