import { rankChunks, truncate } from "./chunking";
import { uid } from "./utils";
import type {
  DocumentChunk,
  KeyTerm,
  PageText,
  Question,
  QuizConfig,
  StudyMaterial,
  WeakTopic,
} from "./types";

/**
 * Demo mode: extractive (non-AI) study material built from the real uploaded
 * PDF. Everything stays functional without an OpenAI key — summaries are
 * first-sentence extracts, terms are detected definition patterns, quizzes
 * are assembled from real definitions and sentences.
 */

function splitSentences(text: string): string[] {
  return text
    .replace(/\[Page \d+\]/g, "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 400);
}

const DEFINITION_RE =
  /^([A-Z][A-Za-z0-9\- ]{2,45}?)\s+(?:is|are|refers to|means|denotes|describes)\s+(.{15,250})[.!?]?$/;

function detectTerms(pages: PageText[]): KeyTerm[] {
  const terms: KeyTerm[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    for (const sentence of splitSentences(p.text)) {
      const m = sentence.match(DEFINITION_RE);
      if (!m) continue;
      const term = m[1].trim().replace(/\s+/g, " ");
      const key = term.toLowerCase();
      if (seen.has(key) || term.split(" ").length > 5) continue;
      seen.add(key);
      terms.push({ term, definition: m[2].trim(), pages: [p.page] });
      if (terms.length >= 15) return terms;
    }
  }
  return terms;
}

export function demoAnalyze(pages: PageText[], chunks: DocumentChunk[]): StudyMaterial {
  const allSentences = pages.flatMap((p) => splitSentences(p.text));
  const oneMinuteSummary =
    allSentences.slice(0, 3).join(" ").slice(0, 500) ||
    "This document could not be summarized.";

  const detailedSummary = chunks
    .map((c) => {
      const s = splitSentences(c.text).slice(0, 2).join(" ");
      return s ? `${s}` : "";
    })
    .filter(Boolean)
    .slice(0, 8)
    .join("\n\n");

  const keyConcepts = chunks.slice(0, 10).map((c) => ({
    name: c.heading,
    description:
      splitSentences(c.text)[0]?.slice(0, 220) ??
      `Content covered on pages ${c.pageStart}–${c.pageEnd}.`,
    pages: range(c.pageStart, c.pageEnd),
  }));

  const keyTerms = detectTerms(pages);

  const sectionSummaries = chunks.map((c) => ({
    heading: c.heading,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
    summary:
      splitSentences(c.text).slice(0, 3).join(" ") ||
      `Material from pages ${c.pageStart}–${c.pageEnd}.`,
  }));

  const sectionNotes = chunks.map((c) => ({
    heading: c.heading,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
    bullets: splitSentences(c.text)
      .slice(0, 6)
      .map((s) => truncate(s, 200)),
  }));

  return {
    summaryPages: [...new Set(chunks.map(c => c.pageStart))],
    oneMinuteSummary,
    detailedSummary,
    keyConcepts,
    keyTerms,
    sectionSummaries,
    sectionNotes,
  };
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Builds quiz questions from detected terms and sentences — no AI required. */
export function demoQuiz(
  pages: PageText[],
  chunks: DocumentChunk[],
  material: StudyMaterial,
  config: QuizConfig,
  focusTopics?: WeakTopic[]
): Question[] {
  const sentences = pages.flatMap(p => splitSentences(p.text).map(text => ({ text, page: p.page })));
  const vocabulary = [...new Set(sentences.flatMap(s => s.text.match(/[A-Za-z]{4,}/g) ?? []))];
  const facts = sentences.map(s => {
    const term = material.keyTerms.find(t => s.text.toLowerCase().includes(t.term.toLowerCase()));
    const topic = term?.term ?? chunks.find(c => c.pageStart <= s.page && c.pageEnd >= s.page)?.heading ?? `Page ${s.page}`;
    return { ...s, topic, term };
  });
  const selected = focusTopics?.length ? facts.filter(f => focusTopics.some(t => t.topic === f.topic)) : facts;
  if (!selected.length || vocabulary.length < 4) throw new Error("Not enough text for this quiz. Try a longer text-based PDF.");
  const candidates = shuffle(selected);
  const wanted: Question["type"][] = config.type === "mixed" ? ["multiple_choice", "true_false", "short_answer"] : [config.type];
  return Array.from({ length: config.questionCount }, (_, i) => {
    const fact = candidates[i % candidates.length];
    const type = wanted[i % wanted.length];
    const words = (fact.text.match(/[A-Za-z]{4,}/g) ?? []).sort((a, b) => b.length - a.length);
    const answer = words[(i + (config.difficulty === "hard" ? 0 : 2)) % words.length];
    const blank = fact.text.replace(new RegExp(`\\b${answer}\\b`), "_____ ");
    const options = shuffle([answer, ...shuffle(vocabulary.filter(w => w.toLowerCase() !== answer.toLowerCase())).slice(0, 3)]);
    const base = { id: uid(), type, difficulty: config.difficulty, topic: fact.topic, pages: [fact.page], explanation: `Source passage: “${fact.text}”` };
    if (type === "multiple_choice") return { ...base, question: `Complete the source passage: “${blank}”`, options, correctAnswer: answer };
    if (type === "true_false") {
      // Swap a recognized term for a different one to create a false statement.
      const proposed = i % 2 ? options.find(o => o !== answer)! : answer;
      return { ...base, question: `True or false: the missing word is “${proposed}”. “${blank}”`, options: null, correctAnswer: proposed === answer ? "True" : "False" };
    }
    if (fact.term && config.difficulty !== "easy") return { ...base, question: `Explain ${fact.term.term} using the document.`, options: null, correctAnswer: fact.term.definition };
    return { ...base, question: `Which word completes this source passage? “${blank}”`, options: null, correctAnswer: answer };
  });
}

/** Demo grader for short answers: keyword overlap with the model answer. */
export function demoGradeShort(correctAnswer: string, answer: string): boolean {
  if (!answer.trim()) return false;
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const model = words(correctAnswer);
  const student = words(answer);
  if (student.size === 0) return false;
  let hits = 0;
  for (const w of student) if (model.has(w)) hits++;
  return hits / Math.max(1, model.size) >= 0.5 && hits / student.size >= 0.35;
}

/** Demo Ask-PDF: retrieve the best chunk and quote supporting sentences. */
export function demoAsk(
  chunks: DocumentChunk[],
  question: string
): { answer: string; pages: number[]; foundInDocument: boolean } {
  const ranked = rankChunks(chunks, question, 2);
  if (ranked.length === 0) {
    return {
      answer:
        "I could not find information about that in this document. Try rephrasing or asking about a topic the document covers.",
      pages: [],
      foundInDocument: false,
    };
  }

  const qWords = new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  const best = ranked
    .flatMap((c) =>
      splitSentences(c.text).map((s) => ({ s, c }))
    )
    .map(({ s, c }) => ({
      s,
      c,
      score: [...qWords].filter((w) => s.toLowerCase().includes(w)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const pages = [...new Set(best.flatMap((b) => range(b.c.pageStart, b.c.pageEnd)))].sort(
    (a, b) => a - b
  );

  return {
    answer: `Based on the document: ${best.map((b) => b.s).join(" ")}`,
    pages,
    foundInDocument: true,
  };
}
