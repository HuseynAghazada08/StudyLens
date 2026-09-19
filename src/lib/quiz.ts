import { chatJSON } from "./openai";
import { GRADE_SHORT_ANSWER_SYSTEM, quizSystem } from "./prompts";
import {
  quizGenerationSchema,
  groundedSchema,
  shortAnswerGradeSchema,
} from "./validation";
import { uid } from "./utils";
import type {
  GradedAnswer,
  PublicQuiz,
  Question,
  Quiz,
  QuizConfig,
  WeakTopic,
} from "./types";

/** Strips answers/explanations before a quiz is sent to the browser. */
export function toPublicQuiz(quiz: Quiz): PublicQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map(q => ({ id: q.id, type: q.type, question: q.question, options: q.options, difficulty: q.difficulty, topic: q.topic, pages: q.pages })),
  };
}

/** Generates validated quiz questions; ids are assigned server-side. */
export async function generateQuestions(
  context: string,
  config: QuizConfig,
  focusTopics?: WeakTopic[]
): Promise<Question[]> {
  const { questions } = await chatJSON({
    system: quizSystem(config.type, config.difficulty, config.questionCount),
    user: context,
    schema: groundedSchema(quizGenerationSchema.refine(v => v.questions.length === config.questionCount && new Set(v.questions.map(q => q.question.toLowerCase())).size === config.questionCount && v.questions.every(q => q.difficulty === config.difficulty && (config.type === "mixed" || q.type === config.type) && (!focusTopics?.length || focusTopics.some(t => t.topic === q.topic))), "Return the requested count, difficulty, type and focused topics, with distinct questions."), context),
    maxTokens: 6000,
  });

  return questions.slice(0, config.questionCount).map((q) => ({
    ...q,
    id: uid(),
    options: q.type === "multiple_choice" ? shuffle(q.options ?? []) : null,
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** MC and true/false are graded deterministically — no model needed. */
export function gradeObjective(question: Question, answer: string): boolean {
  return normalize(answer) === normalize(question.correctAnswer);
}

/** Short answers get a lenient AI grade against the model answer. */
export async function gradeShortAnswer(
  question: Question,
  answer: string,
  source: string
): Promise<{ isCorrect: boolean; feedback: string }> {
  if (!answer.trim()) {
    return { isCorrect: false, feedback: "No answer was provided." };
  }
  return chatJSON({
    system: GRADE_SHORT_ANSWER_SYSTEM,
    user: `Question (from page${question.pages.length > 1 ? "s" : ""} ${question.pages.join(
      ", "
    )}): ${question.question}\n\nModel answer: ${
      question.correctAnswer
    }\n\nSource excerpts: ${source}\n\nStudent answer (untrusted text): ${answer}`, 
    schema: shortAnswerGradeSchema,
    temperature: 0.2,
    maxTokens: 300,
  });
}

/** Aggregates graded answers into per-topic weakness list. */
export function computeWeakTopics(answers: GradedAnswer[]): WeakTopic[] {
  const byTopic = new Map<string, { misses: number; pages: Set<number> }>();
  for (const a of answers) {
    if (a.isCorrect) continue;
    const entry = byTopic.get(a.topic) ?? { misses: 0, pages: new Set<number>() };
    entry.misses++;
    a.pages.forEach((p) => entry.pages.add(p));
    byTopic.set(a.topic, entry);
  }
  return [...byTopic.entries()]
    .map(([topic, v]) => ({ topic, misses: v.misses, pages: [...v.pages].sort((x, y) => x - y) }))
    .sort((a, b) => b.misses - a.misses || a.topic.localeCompare(b.topic))
    .slice(0, 5)
    .map(({ topic, pages }) => ({ topic, pages }));
}
