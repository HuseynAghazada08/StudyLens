import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hasOpenAI } from "@/lib/env";
import { contextForQuiz } from "@/lib/analysis";
import { generateQuestions, toPublicQuiz } from "@/lib/quiz";
import { demoQuiz } from "@/lib/demo";
import { quizConfigSchema } from "@/lib/validation";

import { PageText } from "@/lib/types";

export const maxDuration = 60;

/**
 * POST /api/documents/[id]/quiz
 * Body: { questionCount: 5|10|15, difficulty, type }
 * Returns the quiz with answers stripped (they live server-side for grading).
 */
export const POST = withErrors(async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(true);
  if (isResponse(user)) return user;

  const { id } = await params;
  const parsed = quizConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Invalid quiz configuration.");
  const config = parsed.data;

  const store = await getStore(user.id);
  const document = await store.getDocument(id);
  if (!document || document.userId !== user.id) return err("Document not found.", 404);
  if (document.status !== "ready") {
    return err("This document is not ready yet.", 409);
  }

  const [material, chunks] = await Promise.all([
    store.getMaterial(id),
    store.getChunks(id),
  ]);
  if (!material || chunks.length === 0) {
    return err("Study material is missing for this document.", 409);
  }

  let questions;
  if (hasOpenAI()) {
    const context = contextForQuiz(material, chunks);
    questions = await generateQuestions(context, config);
  } else {
    const pages: PageText[] = chunks.flatMap((c) =>
      // Chunk text is stored with [Page N] markers; recover per-page text.
      splitChunkPages(c.text)
    );
    questions = demoQuiz(pages, chunks, material, config);
  }

  if (questions.length === 0) {
    return err("Could not generate questions from this document.", 502);
  }

  const quiz = await store.createQuiz({
    documentId: id,
    userId: user.id,
    label: `${config.difficulty[0].toUpperCase() + config.difficulty.slice(1)} · ${
      config.questionCount
    } questions`,
    difficulty: config.difficulty,
    type: config.type,
    questionCount: questions.length,
    questions,
  });

  return Response.json({ quiz: toPublicQuiz(quiz) });
});

/** Re-splits stored chunk text on [Page N] markers (demo mode needs PageText[]). */
function splitChunkPages(text: string): PageText[] {
  const parts = text.split(/\[Page (\d+)\]\n/);
  const pages: PageText[] = [];
  // parts alternates: preamble, pageNum, pageText, pageNum, pageText, ...
  for (let i = 1; i + 1 < parts.length; i += 2) {
    pages.push({ page: Number(parts[i]), text: parts[i + 1].trim() });
  }
  return pages;
}
