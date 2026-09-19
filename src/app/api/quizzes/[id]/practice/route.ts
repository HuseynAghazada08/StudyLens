import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hasOpenAI } from "@/lib/env";
import { contextForQuiz } from "@/lib/analysis";
import { generateQuestions, toPublicQuiz } from "@/lib/quiz";
import { demoQuiz } from "@/lib/demo";
import { z } from "zod";
import type { PageText } from "@/lib/types";

export const maxDuration = 60;

const practiceBody = z.object({
  attemptId: z.string().uuid(),
});

/**
 * POST /api/quizzes/[id]/practice
 * Body: { weakTopics: [{ topic, pages }] }
 * Generates a follow-up quiz targeting the topics the student missed,
 * linked to the original via parent_quiz_id.
 */
export const POST = withErrors(async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(true);
  if (isResponse(user)) return user;

  const { id } = await params;
  const parsed = practiceBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("weakTopics are required.");

  const store = await getStore(user.id);
  const quiz = await store.getQuiz(id);
  if (!quiz || quiz.userId !== user.id) return err("Quiz not found.", 404);

  const attempt = await store.getLatestAttempt(id);
  if (!attempt || attempt.attemptId !== parsed.data.attemptId) return err("Submit this quiz before practicing its weak topics.", 409);
  const weakTopics = attempt.weakTopics;
  if (!weakTopics.length) return err("No weak topics were found. Try a harder quiz.", 409);

  const [material, chunks] = await Promise.all([
    store.getMaterial(quiz.documentId),
    store.getChunks(quiz.documentId),
  ]);
  if (!material || chunks.length === 0) {
    return err("Document content is unavailable.", 409);
  }

  const config = {
    questionCount: Math.min(quiz.questionCount, 10) as 5 | 10 | 15,
    difficulty: quiz.difficulty,
    type: quiz.type,
  };

  let questions;
  if (hasOpenAI()) {
    const context = contextForQuiz(material, chunks, weakTopics);
    questions = await generateQuestions(context, config, weakTopics);
  } else {
    const pages: PageText[] = chunks.flatMap((c) =>
      c.text
        .split(/\[Page (\d+)\]\n/)
        .slice(1)
        .reduce<PageText[]>((acc, part, i, arr) => {
          if (i % 2 === 0) acc.push({ page: Number(part), text: (arr[i + 1] ?? "").trim() });
          return acc;
        }, [])
    );
    questions = demoQuiz(pages, chunks, material, config, weakTopics);
  }

  if (questions.length === 0) {
    return err("Could not generate a practice quiz.", 502);
  }

  const practiceQuiz = await store.createQuiz({
    documentId: quiz.documentId,
    userId: user.id,
    label: `Practice · ${weakTopics.map((t) => t.topic).join(", ")}`,
    difficulty: config.difficulty,
    type: config.type,
    questionCount: questions.length,
    questions,
    parentQuizId: quiz.id,
  });

  return Response.json({ quiz: toPublicQuiz(practiceQuiz) });
});
