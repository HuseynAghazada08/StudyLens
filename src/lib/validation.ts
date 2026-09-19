import { z } from "zod";

/**
 * Zod schemas for every JSON shape the model is asked to return.
 * All AI output is parsed through these before it reaches the UI.
 */

const pages = z.array(z.number().int().positive()).min(1).max(100);

export const keyConceptSchema = z.object({
  name: z.string(),
  description: z.string(),
  pages,
});

export const keyTermSchema = z.object({
  term: z.string(),
  definition: z.string(),
  pages,
});

export const sectionSummarySchema = z.object({
  heading: z.string(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  summary: z.string(),
});

export const sectionNotesSchema = z.object({
  heading: z.string(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  bullets: z.array(z.string()),
});

export const studyMaterialSchema = z.object({
  summaryPages: pages,
  oneMinuteSummary: z.string().min(1).max(1500),
  detailedSummary: z.string().min(1).max(6000),
  keyConcepts: z.array(keyConceptSchema),
  keyTerms: z.array(keyTermSchema),
  sectionSummaries: z.array(sectionSummarySchema),
  sectionNotes: z.array(sectionNotesSchema),
});

export const chunkDigestSchema = z.object({
  keyPoints: z.array(z.string()),
  terms: z.array(keyTermSchema),
});

export const questionSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  question: z.string(),
  options: z.array(z.string()).nullable().default(null),
  correctAnswer: z.string(),
  explanation: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  topic: z.string().min(1).max(120),
  pages,
}).superRefine((q, ctx) => {
  if (!q.question.trim() || !q.correctAnswer.trim() || !q.explanation.trim()) {
    ctx.addIssue({ code: "custom", message: "Question, answer and explanation are required." });
  }
  if (q.type === "multiple_choice" && (!q.options || q.options.length !== 4 || new Set(q.options).size !== 4 || !q.options.includes(q.correctAnswer))) {
    ctx.addIssue({ code: "custom", message: "Multiple choice requires four distinct options including the correct answer." });
  }
  if (q.type === "true_false" && !["True", "False"].includes(q.correctAnswer)) {
    ctx.addIssue({ code: "custom", message: "True/false answer must be True or False." });
  }
  if (q.type !== "multiple_choice" && q.options !== null) {
    ctx.addIssue({ code: "custom", message: "Only multiple choice questions have options." });
  }
});

export function groundedSchema<T>(schema: z.ZodType<T>, context: string): z.ZodType<T> {
  const allowed = new Set([...context.matchAll(/\[Page (\d+)\]/g)].map(m => Number(m[1])));
  return schema.superRefine((value, ctx) => {
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      for (const key of ["pages", "summaryPages"]) {
        if (Array.isArray(record[key]) && record[key].some(p => typeof p !== "number" || !allowed.has(p))) ctx.addIssue({ code: "custom", message: "A citation is outside the supplied source pages." });
      }
      if (typeof record.pageStart === "number" && typeof record.pageEnd === "number") {
        if (record.pageStart > record.pageEnd || !allowed.has(record.pageStart) || !allowed.has(record.pageEnd)) ctx.addIssue({ code: "custom", message: "Invalid section page range." });
      }
      Object.values(record).forEach(visit);
    };
    visit(value);
  });
}

export const quizGenerationSchema = z.object({
  questions: z.array(questionSchema),
});

export const askAnswerSchema = z.object({
  answer: z.string().min(1),
  pages: z.array(z.number().int().positive()),
  foundInDocument: z.boolean(),
}).refine(v => v.foundInDocument ? v.pages.length > 0 : v.pages.length === 0, "Citations must match whether evidence was found.");

export const shortAnswerGradeSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
});

/** Quiz config sent from the client. */
export const quizConfigSchema = z.object({
  questionCount: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  type: z.enum(["multiple_choice", "true_false", "short_answer", "mixed"]),
});

export const submitQuizSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string().max(3000),
    })
  ).min(1).max(15).refine(items => new Set(items.map(a => a.questionId)).size === items.length, "Duplicate question IDs."),
});
