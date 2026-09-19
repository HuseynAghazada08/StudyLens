import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hasOpenAI } from "@/lib/env";
import {
  computeWeakTopics,
  gradeObjective,
  gradeShortAnswer,
} from "@/lib/quiz";
import { demoGradeShort } from "@/lib/demo";
import { submitQuizSchema } from "@/lib/validation";
import type { GradedAnswer } from "@/lib/types";

export const maxDuration = 60;

/**
 * POST /api/quizzes/[id]/submit
 * Body: { answers: [{ questionId, answer }] }
 * Grades the attempt, persists it, and returns per-question results,
 * explanations, page references, and weak topics.
 */
export const POST = withErrors(async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(true);
  if (isResponse(user)) return user;

  const { id } = await params;
  const parsed = submitQuizSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Invalid submission.");

  const store = await getStore(user.id);
  const quiz = await store.getQuiz(id);
  if (!quiz || quiz.userId !== user.id) return err("Quiz not found.", 404);

  if (parsed.data.answers.some(a => !quiz.questions.some(q => q.id === a.questionId))) return err("Submission contains a question from another quiz.");
  const chunks = await store.getChunks(quiz.documentId);
  const answerMap = new Map(parsed.data.answers.map((a) => [a.questionId, a.answer]));

  const graded: GradedAnswer[] = await Promise.all(
    quiz.questions.map(async (q) => {
      const userAnswer = answerMap.get(q.id) ?? "";
      let isCorrect: boolean;
      let explanation = q.explanation;

      if (q.type === "short_answer") {
        if (hasOpenAI()) {
          const source = chunks.filter(c => q.pages.some(p => p >= c.pageStart && p <= c.pageEnd)).slice(0, 4).map(c => c.text).join("\n\n");
          const g = await gradeShortAnswer(q, userAnswer, source);
          isCorrect = g.isCorrect;
          explanation = `${g.feedback} ${q.explanation}`.trim();
        } else {
          isCorrect = demoGradeShort(q.correctAnswer, userAnswer);
        }
      } else {
        isCorrect = gradeObjective(q, userAnswer);
      }

      return {
        questionId: q.id,
        question: q.question,
        type: q.type,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation,
        topic: q.topic,
        pages: q.pages,
      };
    })
  );

  const score = graded.filter((a) => a.isCorrect).length;
  const weakTopics = computeWeakTopics(graded);

  const attemptId = await store.createAttempt({
    quizId: quiz.id,
    userId: user.id,
    score,
    total: graded.length,
    answers: graded,
    weakTopics,
  });

  return Response.json({
    attemptId,
    quizId: quiz.id,
    score,
    total: graded.length,
    answers: graded,
    weakTopics,
  });
});
