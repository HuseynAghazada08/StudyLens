"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, BookOpen, FileText, GraduationCap, ListChecks, MessageSquare, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, Spinner, Tabs } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SummaryTab } from "@/components/workspace/SummaryTab";
import { NotesTab } from "@/components/workspace/NotesTab";
import { QuizTab } from "@/components/workspace/QuizTab";
import { AskTab } from "@/components/workspace/AskTab";
import { SourceViewer } from "@/components/workspace/SourceViewer";
import type { DocumentDetail } from "@/lib/types";

const TABS = [
  { id: "summary", label: "Summary", icon: <FileText className="h-4 w-4" /> },
  { id: "notes", label: "Study Notes", icon: <BookOpen className="h-4 w-4" /> },
  { id: "quiz", label: "Quiz", icon: <ListChecks className="h-4 w-4" /> },
  { id: "ask", label: "Ask PDF", icon: <MessageSquare className="h-4 w-4" /> },
];

export default function DocumentWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("summary");
  const [demoMode, setDemoMode] = useState(false);
  const [sourcePage, setSourcePage] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load this document.");
      setDetail(data);
      setDemoMode(Boolean(data.demoMode));
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Network error. Please retry."); }
  }, [id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  // Poll while the document is still processing.
  useEffect(() => {
    if (detail?.document.status !== "processing") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [detail?.document.status, load]);

  const retry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/documents/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Retry failed."); }
    finally { setRetrying(false); }
  };

  if (!detail) return <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">{error ? <><AlertTriangle className="text-red-500" /><p role="alert">{error}</p><Button onClick={load}>Retry</Button><Link href="/dashboard" className="text-indigo-600 underline">Back to dashboard</Link></> : <Spinner label="Loading your study session…" />}</main>;

  const { document: doc, material, quizzes, pages } = detail;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-7 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="rounded-xl border border-stone-200 p-2 dark:border-stone-700" aria-label="Back to dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white sm:flex"><GraduationCap className="h-6 w-6" /></span>
          <div className="min-w-0"><p className="mb-1 text-xs font-medium uppercase tracking-widest text-indigo-500">Study workspace</p><h1 className="truncate font-semibold" title={doc.name}>{doc.name}</h1><p className="text-xs text-stone-500">{doc.pageCount} pages · {doc.status === "ready" ? "Ready to study" : doc.status}</p></div>
        </div>
        <ThemeToggle />
      </header>
      {demoMode && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><strong>Offline demo.</strong> Summaries use extracted passages; quizzes use word-recall exercises. Difficulty changes recall prompts, not AI reasoning. Short answers use approximate keyword grading. Connect OpenAI for richer study material.</div>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {doc.status === "processing" && <Card className="p-8"><Spinner label="Analyzing your document…" /><p className="mt-4 text-sm text-stone-500">If processing was interrupted, retry after five minutes.</p><Button className="mt-4" variant="secondary" loading={retrying} onClick={retry}>Retry interrupted analysis</Button></Card>}
      {doc.status === "error" && <Card className="p-8"><h2 className="font-medium text-red-600">Analysis failed</h2><p className="my-3 text-sm text-stone-500">{doc.error}</p><Button loading={retrying} onClick={retry}>Retry analysis</Button></Card>}
      {doc.status === "ready" && material && <>
        <div className="mb-5 flex flex-wrap items-center gap-2"><Badge tone="green"><CheckCircle2 className="h-3 w-3" />Document processed</Badge><Badge tone="neutral">{material.keyConcepts.length} concepts</Badge><Badge tone="neutral">{material.keyTerms.length} key terms</Badge><Button size="sm" variant="ghost" onClick={() => setSourcePage(1)}>Read source pages</Button></div>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <div className="mt-6 flex-1">
          <section role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" hidden={tab !== "summary"}><SummaryTab material={material} onNavigate={setSourcePage} /></section>
          <section role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" hidden={tab !== "notes"}><NotesTab material={material} onNavigate={setSourcePage} /></section>
          <section role="tabpanel" id="panel-quiz" aria-labelledby="tab-quiz" hidden={tab !== "quiz"}><QuizTab documentId={doc.id} pastQuizzes={quizzes} onNavigate={setSourcePage} /></section>
          <section role="tabpanel" id="panel-ask" aria-labelledby="tab-ask" hidden={tab !== "ask"}><AskTab documentId={doc.id} onNavigate={setSourcePage} /></section>
        </div>
      </>}
      <SourceViewer page={sourcePage} pages={pages ?? []} onPage={setSourcePage} onClose={() => setSourcePage(null)} />
    </main>
  );
}
