import Link from "next/link";
import {
  BookOpenCheck,
  FileText,
  GraduationCap,
  Layers,
  Quote,
  Sparkles,
} from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: <Sparkles className="h-6 w-6" aria-hidden />,
    title: "Smart Summaries",
    body: "Start with the big picture. Get a one-minute overview, key concepts, and section notes grounded in your PDF.",
  },
  {
    icon: <BookOpenCheck className="h-6 w-6" aria-hidden />,
    title: "Adaptive Quizzes",
    body: "Multiple choice, true/false, and short answer questions. Miss a topic? Generate a quiz that targets exactly that.",
  },
  {
    icon: <Quote className="h-6 w-6" aria-hidden />,
    title: "Cited Answers",
    body: "Every explanation and chat answer links back to the exact page it came from, so you can verify instantly.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          StudyLens
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            Open App
          </Link>
        </div>
      </header>

      <main className="flex-1" id="main">
        <section className="relative isolate overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.15),transparent)]"
            aria-hidden
          />
          <div className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
            <Badge tone="indigo" className="mb-6">
              <FileText className="h-3 w-3" aria-hidden />
              Built for students
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Turn any PDF into a{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                personalized study session
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-stone-500 dark:text-stone-400">
              Upload lecture slides, a textbook chapter, or a paper. StudyLens
              reads it, builds notes and quizzes grounded in the actual pages,
              and helps you fix what you got wrong.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
              >
                <Layers className="h-5 w-5" aria-hidden />
                Upload Your PDF
              </Link>
            </div>
          </div>
        </section>

        <section aria-label="Example study session" className="mx-auto mb-20 max-w-5xl px-6">
          <div className="rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-100/70 via-violet-50 to-stone-100 p-3 shadow-[0_24px_90px_-40px_rgba(79,70,229,0.45)] sm:p-6 dark:border-indigo-950 dark:from-indigo-950/60 dark:via-stone-900 dark:to-stone-950">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 dark:border-stone-800"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-indigo-500" /><div><p className="text-sm font-semibold">Cell Biology.pdf</p><p className="text-xs text-stone-400">4 pages · Example session</p></div></div><Badge tone="green">Ready to learn</Badge></div>
              <div className="grid gap-6 p-5 sm:grid-cols-[1.4fr_1fr] sm:p-8">
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">The big picture</p><h2 className="text-2xl font-semibold tracking-tight">From information<br />to understanding.</h2><p className="mt-4 text-sm leading-7 text-stone-500 dark:text-stone-400">Cells are the building blocks of life. Their structures work together to exchange materials, release energy, and pass on genetic information.</p><div className="mt-5 flex flex-wrap gap-2"><Badge tone="indigo">Cell structures</Badge><Badge tone="indigo">Energy & transport</Badge><Badge tone="indigo">Genetics</Badge></div></div>
                <div className="space-y-3"><div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">A concept that sticks</span><Badge tone="indigo">p.2</Badge></div><p className="text-sm leading-6 text-stone-500 dark:text-stone-400"><strong className="text-stone-800 dark:text-stone-200">Photosynthesis</strong> converts light energy into chemical energy stored in sugars.</p></div><div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950/50"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300"><BookOpenCheck className="h-4 w-4" />Learn. Test. Improve.</div><p className="text-xs leading-6 text-stone-500 dark:text-stone-400">Take a quiz, see what needs another look, and practice those concepts again.</p></div></div>
              </div>
              <div className="border-t border-stone-100 px-5 py-3 text-center text-xs text-stone-400 dark:border-stone-800">Your document is the source. Every citation brings you back to it.</div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="p-6">
                <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  {f.icon}
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                  {f.body}
                </p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-400 dark:border-stone-800">
        StudyLens · Hackathon build
      </footer>
    </div>
  );
}
