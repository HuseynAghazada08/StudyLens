import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hasOpenAI } from "@/lib/env";
import { contextForQuery } from "@/lib/analysis";
import { chatJSON } from "@/lib/openai";
import { ASK_SYSTEM } from "@/lib/prompts";
import { askAnswerSchema, groundedSchema } from "@/lib/validation";

export const maxDuration = 60;
import { demoAsk } from "@/lib/demo";
import { z } from "zod";

const askBody = z.object({
  question: z.string().min(3).max(2000),
});

/**
 * POST /api/documents/[id]/ask — answers strictly from the document's most
 * relevant chunks, with page citations.
 */
export const POST = withErrors(async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(true);
  if (isResponse(user)) return user;

  const { id } = await params;
  const parsed = askBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Ask a question (3–2000 characters).");

  const store = await getStore(user.id);
  const document = await store.getDocument(id);
  if (!document || document.userId !== user.id) return err("Document not found.", 404);
  if (document.status !== "ready") return err("This document is not ready yet.", 409);

  const chunks = await store.getChunks(id);
  if (chunks.length === 0) return err("Document content is unavailable.", 409);

  if (!hasOpenAI()) {
    return Response.json(demoAsk(chunks, parsed.data.question));
  }

  const relevant = contextForQuery(chunks, parsed.data.question, 5);
  const context = relevant
    .map(
      (c) =>
        `Section "${c.heading}" (pages ${c.pageStart}-${c.pageEnd}):\n${c.text}`
    )
    .join("\n\n");

  const result = await chatJSON({
    system: ASK_SYSTEM,
    user: `Document excerpts:\n\n${context}\n\nStudent question: ${parsed.data.question}`,
    schema: groundedSchema(askAnswerSchema, context),
    temperature: 0.3,
    maxTokens: 1200,
  });

  return Response.json(result);
});
