"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  Target,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
} from "@/components/ui";
import { PageCitation } from "@/components/PageCitation";
import { cn } from "@/lib/utils";
import { hasSupabase } from "@/lib/env-client";
import { browserQuiz, browserPractice, browserResult, browserSubmit } from "@/lib/browser-store";
import type {
  Difficulty,
  PublicQuiz,
  QuizResult,
  QuizTypeOption,
} from "@/lib/types";

async function quizRequest<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "The quiz operation failed. Please retry.");
  return data;
}

type Phase = "config" | "taking" | "results";

const QUESTION_COUNTS = [5, 10, 15] as const;
const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];
const TYPES: { id: QuizTypeOption; label: string }[] = [
  { id: "multiple_choice", label: "Multiple choice" },
  { id: "true_false", label: "True / False" },
  { id: "short_answer", label: "Short answer" },
  { id: "mixed", label: "Mixed" },
];

export function QuizTab({
  documentId,
  pastQuizzes,
  onNavigate,
}: {
  documentId: string;
  pastQuizzes: PublicQuiz[];
  onNavigate?: (page: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("config");
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [knownQuizzes, setKnownQuizzes] = useState(pastQuizzes);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [count, setCount] = useState<5 | 10 | 15>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [type, setType] = useState<QuizTypeOption>("mixed");

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const config = { questionCount: count, difficulty, type };
      const data = !hasSupabase ? await browserQuiz(documentId, config) : await quizRequest<{ quiz: PublicQuiz }>(`/api/documents/${documentId}/quiz`, config);
      setQuiz(data.quiz);
      setKnownQuizzes(previous => [data.quiz, ...previous]);
      setResult(null);
      setPhase("taking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quiz generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const practiceWeak = async () => {
    if (!result || result.weakTopics.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const data = !hasSupabase ? await browserPractice(result.quizId, result.attemptId) : await quizRequest<{ quiz: PublicQuiz }>(`/api/quizzes/${result.quizId}/practice`, { attemptId: result.attemptId });
      setQuiz(data.quiz);
      setKnownQuizzes(previous => [data.quiz, ...previous]);
      setResult(null);
      setPhase("taking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build practice quiz.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {phase === "config" && (
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Build your quiz</h3>
            <div className="flex flex-col gap-5">
              <OptionRow label="Questions">
                {QUESTION_COUNTS.map((n) => (
                  <SegButton key={n} active={count === n} onClick={() => setCount(n)}>
                    {n}
                  </SegButton>
                ))}
              </OptionRow>
              <OptionRow label="Difficulty">
                {DIFFICULTIES.map((d) => (
                  <SegButton
                    key={d.id}
                    active={difficulty === d.id}
                    onClick={() => setDifficulty(d.id)}
                  >
                    {d.label}
                  </SegButton>
                ))}
              </OptionRow>
              <OptionRow label="Question type">
                {TYPES.map((t) => (
                  <SegButton
                    key={t.id}
                    active={type === t.id}
                    onClick={() => setType(t.id)}
                  >
                    {t.label}
                  </SegButton>
                ))}
              </OptionRow>
            </div>
            <Button className="mt-6" size="lg" loading={busy} onClick={generate}>
              <ListChecks className="h-4 w-4" aria-hidden />
              Generate Quiz
            </Button>
          </Card>

          {knownQuizzes.length > 0 && (
            <section>
              <h3 className="mb-3 font-semibold">Previous quizzes</h3>
              <ul className="flex flex-col gap-2">
                {knownQuizzes.map((q) => (
                  <li key={q.id}>
                    <button
                      className="flex w-full items-center justify-between rounded-xl border border-stone-200 px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"
                      onClick={() => {
                        // Strip answers/explanations so the taker never sees them.
                        setQuiz({
                          id: q.id,
                          documentId: q.documentId,
                          userId: q.userId,
                          label: q.label,
                          difficulty: q.difficulty,
                          type: q.type,
                          questionCount: q.questionCount,
                          parentQuizId: q.parentQuizId,
                          createdAt: q.createdAt,
                          questions: q.questions,
                        });
                        setResult(null);
                        setPhase("taking");
                      }}
                    >
                      <span>{q.label}</span>
                      <Badge tone="neutral">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </Badge>
                    </button>
                    <button className="mt-1 px-4 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-300" disabled={busy} onClick={async () => {
                      setBusy(true); setError(null);
                      try {
                        const data = !hasSupabase ? await browserResult(q.id) : await quizRequest<QuizResult>(`/api/quizzes/${q.id}/result`);
                        setQuiz(q); setResult(data); setPhase("results");
                      } catch (e) { setError(e instanceof Error ? e.message : "Could not load results."); }
                      finally { setBusy(false); }
                    }}>View last result</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {phase === "taking" && quiz && (
        <QuizTaker
          key={quiz.id}
          quiz={quiz}
          onFinish={(r) => {
            setResult(r);
            setPhase("results");
          }}
          onCancel={() => setPhase("config")}
        />
      )}

      {phase === "results" && result && quiz && (
        <QuizResults
          result={result}
          busy={busy}
          onPractice={practiceWeak}
          onNewQuiz={() => setPhase("config")}
          onNavigate={onNavigate}
        />
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/* --------------------------- Config helpers ---------------------------- */

function OptionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-stone-500 dark:text-stone-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-stone-300 text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-600"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Quiz taker ----------------------------- */

function QuizTaker({
  quiz,
  onFinish,
  onCancel,
}: {
  quiz: PublicQuiz;
  onFinish: (r: QuizResult) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = quiz.questions[index];
  const isLast = index === quiz.questions.length - 1;
  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;

  const setAnswer = (value: string) =>
    setAnswers((prev) => ({ ...prev, [q.id]: value }));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const submitted = quiz.questions.map(question => ({ questionId: question.id, answer: answers[question.id] ?? "" }));
      const data = !hasSupabase ? await browserSubmit(quiz.id, submitted) : await quizRequest<QuizResult>(`/api/quizzes/${quiz.id}/submit`, { answers: submitted });
      onFinish(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grading failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
            {quiz.label}
          </p>
          <p className="font-semibold">
            Question {index + 1} of {quiz.questions.length}
          </p>
        </div>
        <Badge tone="indigo">{q.difficulty}</Badge>
      </div>
      <Progress value={answeredCount} max={quiz.questions.length} />

      <div className="mt-6">
        <p className="mb-1 text-sm text-stone-500 dark:text-stone-400">
          {q.type === "multiple_choice"
            ? "Multiple choice"
            : q.type === "true_false"
              ? "True or false"
              : "Short answer"}{" "}
          · {q.topic}
        </p>
        <h3 className="mb-5 text-lg font-medium leading-relaxed">{q.question}</h3>

        {q.type === "multiple_choice" && q.options && (
          <div className="flex flex-col gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setAnswer(opt)}
                aria-pressed={answers[q.id] === opt}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  answers[q.id] === opt
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    answers[q.id] === opt
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-stone-300 text-stone-500 dark:border-stone-600"
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.type === "true_false" && (
          <div className="flex gap-3">
            {["True", "False"].map((v) => (
              <SegButton
                key={v}
                active={answers[q.id] === v}
                onClick={() => setAnswer(v)}
              >
                {v}
              </SegButton>
            ))}
          </div>
        )}

        {q.type === "short_answer" && (
          <textarea
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            maxLength={3000}
            aria-label="Your answer"
            placeholder="Type your answer…"
            className="w-full rounded-xl border border-stone-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-stone-700"
          />
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0 || submitting}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
          {isLast ? (
            <Button onClick={submit} loading={submitting}>
              Submit ({answeredCount}/{quiz.questions.length} answered)
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setIndex((i) => Math.min(quiz.questions.length - 1, i + 1))}
            >
              Next
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ Results -------------------------------- */

function QuizResults({
  result,
  busy,
  onPractice,
  onNewQuiz,
  onNavigate,
}: {
  result: QuizResult;
  busy: boolean;
  onPractice: () => void;
  onNewQuiz: () => void;
  onNavigate?: (page: number) => void;
}) {
  const pct = Math.round((result.score / Math.max(1, result.total)) * 100);

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-stone-500 dark:text-stone-400">Your score</p>
            <p className="text-3xl font-bold">
              {result.score}
              <span className="text-lg font-medium text-stone-400">
                /{result.total}
              </span>{" "}
              <span
                className={cn(
                  "text-lg",
                  pct >= 70
                    ? "text-emerald-600 dark:text-emerald-400"
                    : pct >= 40
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                )}
              >
                {pct}%
              </span>
            </p>
          </div>
          <Button variant="secondary" onClick={onNewQuiz}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            New Quiz
          </Button>
        </div>
      </Card>

      {result.weakTopics.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-3 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
            <Target className="h-4 w-4" aria-hidden />
            Weak topics to review
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {result.weakTopics.map((t) => (
              <Badge key={t.topic} tone="amber">
                {t.topic}
                {t.pages.length > 0 && (
                  <span className="opacity-70">
                    {" "}
                    · p.{t.pages.join(", p.")}
                  </span>
                )}
              </Badge>
            ))}
          </div>
          <Button onClick={onPractice} loading={busy}>
            Practice My Weak Topics
          </Button>
        </Card>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50/50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            Perfect run — no weak topics detected. Try a harder quiz!
          </p>
        </Card>
      )}

      <section>
        <h3 className="mb-3 font-semibold">Answer review</h3>
        {result.answers.length === 0 && (
          <EmptyState title="Nothing to review" hint="Take a quiz first." />
        )}
        <ul className="flex flex-col gap-3">
          {result.answers.map((a) => (
            <li key={a.questionId}>
              <Card
                className={cn(
                  "p-5",
                  a.isCorrect
                    ? "border-emerald-200 dark:border-emerald-900"
                    : "border-red-200 dark:border-red-900"
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="font-medium leading-relaxed">{a.question}</p>
                  {a.isCorrect ? (
                    <CheckCircle2
                      className="h-5 w-5 shrink-0 text-emerald-500"
                      aria-label="Correct"
                    />
                  ) : (
                    <XCircle
                      className="h-5 w-5 shrink-0 text-red-500"
                      aria-label="Incorrect"
                    />
                  )}
                </div>
                <div className="mb-2 flex flex-col gap-1 text-sm">
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">
                      Your answer:{" "}
                    </span>
                    <span
                      className={
                        a.isCorrect
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300"
                      }
                    >
                      {a.userAnswer.trim() || "—"}
                    </span>
                  </p>
                  {!a.isCorrect && (
                    <p>
                      <span className="text-stone-500 dark:text-stone-400">
                        Correct answer:{" "}
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {a.correctAnswer}
                      </span>
                    </p>
                  )}
                </div>
                <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">
                  {a.explanation}
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{a.topic}</Badge>
                  <PageCitation pages={a.pages} onNavigate={onNavigate} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
