import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "./env";
import { uid } from "./utils";
import type {
  DocumentChunk,
  GradedAnswer,
  Question,
  Quiz,
  QuizResult,
  QuizTypeOption,
  Difficulty,
  DocumentStatus,
  StudyDocument,
  StudyMaterial,
  WeakTopic,
} from "./types";

/**
 * Server storage abstraction backed by Supabase Postgres.
 * Routes enforce ownership before service-role operations.
 * Standalone demo documents live in browser-store.ts, not server memory.
 */
export interface Store {
  createDocument(input: {
    userId: string;
    name: string;
    pageCount: number;
  }): Promise<StudyDocument>;
  setDocumentStatus(id: string, status: DocumentStatus, error?: string): Promise<void>;
  getDocument(id: string): Promise<StudyDocument | null>;
  listDocuments(userId: string): Promise<StudyDocument[]>;
  saveChunks(documentId: string, chunks: DocumentChunk[]): Promise<void>;
  getChunks(documentId: string): Promise<DocumentChunk[]>;
  saveMaterial(documentId: string, material: StudyMaterial): Promise<void>;
  getMaterial(documentId: string): Promise<StudyMaterial | null>;
  createQuiz(input: {
    documentId: string;
    userId: string;
    label: string;
    difficulty: Difficulty;
    type: QuizTypeOption;
    questionCount: number;
    questions: Question[];
    parentQuizId?: string | null;
  }): Promise<Quiz>;
  getQuiz(id: string): Promise<Quiz | null>;
  listQuizzes(documentId: string): Promise<Quiz[]>;
  getLatestAttempt(quizId: string): Promise<QuizResult | null>;
  createAttempt(input: {
    quizId: string;
    userId: string;
    score: number;
    total: number;
    answers: GradedAnswer[];
    weakTopics: WeakTopic[];
  }): Promise<string>;
}

/* ------------------------------ Supabase ------------------------------- */

interface DocRow {
  id: string;
  user_id: string;
  name: string;
  page_count: number;
  status: DocumentStatus;
  error: string | null;
  created_at: string;
}

const toDoc = (r: DocRow): StudyDocument => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  pageCount: r.page_count,
  status: r.status,
  error: r.error,
  createdAt: r.created_at,
});

interface QuestionRow {
  id: string;
  type: Question["type"];
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: Difficulty;
  topic: string;
  pages: number[] | null;
  order_index: number;
}

const toQuestion = (r: QuestionRow): Question => ({
  id: r.id,
  type: r.type,
  question: r.question,
  options: r.options,
  correctAnswer: r.correct_answer,
  explanation: r.explanation,
  difficulty: r.difficulty,
  topic: r.topic,
  pages: r.pages ?? [],
});

interface QuizRow {
  id: string;
  document_id: string;
  user_id: string;
  label: string;
  difficulty: Difficulty;
  type: QuizTypeOption;
  question_count: number;
  parent_quiz_id: string | null;
  created_at: string;
  questions: QuestionRow[];
}

const toQuiz = (r: QuizRow): Quiz => ({
  id: r.id,
  documentId: r.document_id,
  userId: r.user_id,
  label: r.label,
  difficulty: r.difficulty,
  type: r.type,
  questionCount: r.question_count,
  questions: [...(r.questions ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map(toQuestion),
  parentQuizId: r.parent_quiz_id,
  createdAt: r.created_at,
});

function supabaseStore(sb: SupabaseClient, userId: string): Store {
  return {
    async createDocument({ name, pageCount }) {
      const { data: row, error } = await sb
        .from("documents")
        .insert({ user_id: userId, name, page_count: pageCount, status: "processing" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toDoc(row as DocRow);
    },
    async setDocumentStatus(id, status, error) {
      const { error: e } = await sb
        .from("documents")
        .update({ status, error: error ?? null })
        .eq("id", id);
      if (e) throw new Error(e.message);
    },
    async getDocument(id) {
      const { data: row, error } = await sb
        .from("documents")
        .select()
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row ? toDoc(row as DocRow) : null;
    },
    async listDocuments(uidFilter) {
      const { data: rows, error } = await sb
        .from("documents")
        .select()
        .eq("user_id", uidFilter)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (rows as DocRow[]).map(toDoc);
    },
    async saveChunks(documentId, chunks) {
      const rows = chunks.map((c, i) => ({
        document_id: documentId,
        page_start: c.pageStart,
        page_end: c.pageEnd,
        heading: c.heading,
        content: c.text,
        order_index: i,
      }));
      const { error } = await sb.from("document_sections").insert(rows);
      if (error) throw new Error(error.message);
    },
    async getChunks(documentId) {
      const { data: rows, error } = await sb
        .from("document_sections")
        .select()
        .eq("document_id", documentId)
        .order("order_index");
      if (error) throw new Error(error.message);
      return (rows ?? []).map((r) => ({
        pageStart: r.page_start,
        pageEnd: r.page_end,
        heading: r.heading,
        text: r.content,
      }));
    },
    async saveMaterial(documentId, material) {
      const { error } = await sb
        .from("summaries")
        .upsert({ document_id: documentId, material });
      if (error) throw new Error(error.message);
    },
    async getMaterial(documentId) {
      const { data: row, error } = await sb
        .from("summaries")
        .select("material")
        .eq("document_id", documentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (row?.material as StudyMaterial | undefined) ?? null;
    },
    async createQuiz(input) {
      const { data: quizRow, error } = await sb
        .from("quizzes")
        .insert({
          document_id: input.documentId,
          user_id: input.userId,
          label: input.label,
          difficulty: input.difficulty,
          type: input.type,
          question_count: input.questionCount,
          parent_quiz_id: input.parentQuizId ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      const qRows = input.questions.map((q, i) => ({
        id: q.id,
        quiz_id: quizRow.id,
        order_index: i,
        type: q.type,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topic: q.topic,
        pages: q.pages,
      }));
      const { error: qErr } = await sb.from("questions").insert(qRows);
      if (qErr) throw new Error(qErr.message);

      return {
        id: quizRow.id,
        documentId: input.documentId,
        userId: input.userId,
        label: input.label,
        difficulty: input.difficulty,
        type: input.type,
        questionCount: input.questionCount,
        questions: input.questions,
        parentQuizId: input.parentQuizId ?? null,
        createdAt: quizRow.created_at,
      };
    },
    async getQuiz(id) {
      const { data: row, error } = await sb
        .from("quizzes")
        .select("*, questions(*)")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row ? toQuiz(row as QuizRow) : null;
    },
    async listQuizzes(documentId) {
      const { data: rows, error } = await sb
        .from("quizzes")
        .select("*, questions(*)")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (rows as QuizRow[]).map(toQuiz);
    },
    async getLatestAttempt(quizId) {
      const { data: row, error } = await sb.from("quiz_attempts").select("result").eq("quiz_id", quizId).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return row?.result as QuizResult | null ?? null;
    },
    async createAttempt({ quizId, userId: uidIn, score, total, answers, weakTopics }) {
      const attemptId = uid();
      const result: QuizResult = { attemptId, quizId, score, total, answers, weakTopics };
      const { data: attempt, error } = await sb
        .from("quiz_attempts")
        .insert({ id: attemptId, quiz_id: quizId, user_id: uidIn, score, total, result })
        .select()
        .single();
      if (error) throw new Error(error.message);

      const answerRows = answers.map((a) => ({
        attempt_id: attempt.id,
        question_id: a.questionId,
        user_answer: a.userAnswer,
        is_correct: a.isCorrect,
      }));
      if (answerRows.length) {
        const { error: aErr } = await sb.from("answers").insert(answerRows);
        if (aErr) throw new Error(aErr.message);
      }

      const weakRows = weakTopics.map((t) => ({
        attempt_id: attempt.id,
        topic: t.topic,
        pages: t.pages,
      }));
      if (weakRows.length) {
        const { error: wErr } = await sb.from("weak_topics").insert(weakRows);
        if (wErr) throw new Error(wErr.message);
      }

      return attempt.id as string;
    },
  };
}

/**
 * Returns server storage bound to the authenticated user.
 * Demo requests must use browser storage rather than a server-memory fallback.
 */
export async function getStore(userId: string): Promise<Store> {
  if (!hasSupabase()) throw new Error("Demo documents use browser storage. Server storage requires Supabase.");
  if (!env.supabaseServiceKey) throw new Error("Server storage configuration is incomplete.");
  const sb = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabaseStore(sb, userId);
}
