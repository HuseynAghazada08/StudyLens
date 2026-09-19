"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  FileText,
  GraduationCap,
  Loader2,
  LogOut,
} from "lucide-react";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UploadDropzone } from "@/components/UploadDropzone";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/env-client";
import { listBrowserDocuments } from "@/lib/browser-store";
import type { StudyDocument } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<StudyDocument[] | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const browserStorage = !hasSupabase;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabase) {
      listBrowserDocuments().then(documents => { setDocuments(documents); setDemoMode(true); }).catch(e => setError(e.message));
      return;
    }
    fetch("/api/documents")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load documents");
        return data;
      })
      .then((data) => {
        if (!data) return;
        setDocuments(data.documents);
        setDemoMode(data.demoMode);
      })
      .catch((e) => setError(e.message));
  }, [router]);

  const signOut = async () => {
    if (!hasSupabase) return;
    await createSupabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          StudyLens
        </Link>
        <div className="flex items-center gap-3">
          {demoMode && <Badge tone="amber">Demo mode</Badge>}
          <ThemeToggle />
          {hasSupabase && (
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          )}
        </div>
      </header>

      <section className="mb-10">
        <h1 className="mb-1 text-2xl font-bold">Your study workspace</h1>
        <p className="mb-5 text-stone-500 dark:text-stone-400">
          Upload a PDF and StudyLens builds summaries, notes, and quizzes from it.
        </p>
        <UploadDropzone />
        {browserStorage && <p className="mt-3 text-xs text-stone-500">Saved in this browser. Documents and quiz results survive refreshes and server restarts. They are not shared across devices or deployment domains; clearing site data removes them.</p>}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Documents</h2>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        {!error && documents === null && <Spinner label="Loading documents…" />}
        {documents?.length === 0 && (
          <EmptyState
            icon={<FileText className="h-8 w-8" aria-hidden />}
            title="No documents yet"
            hint="Upload your first PDF to generate study material."
          />
        )}
        {documents && documents.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link href={`/documents/${doc.id}`}>
                  <Card className="h-full p-5 transition-shadow hover:shadow-md">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <FileText
                        className="h-8 w-8 shrink-0 text-indigo-500"
                        aria-hidden
                      />
                      <StatusBadge status={doc.status} />
                    </div>
                    <p className="mb-1 truncate font-medium" title={doc.name}>
                      {doc.name}
                    </p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"} ·{" "}
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: StudyDocument["status"] }) {
  if (status === "ready") return <Badge tone="green">Ready</Badge>;
  if (status === "processing")
    return (
      <Badge tone="indigo">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Processing
      </Badge>
    );
  return (
    <Badge tone="red">
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Error
    </Badge>
  );
}
