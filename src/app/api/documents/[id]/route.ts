import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hasOpenAI, hasSupabase } from "@/lib/env";
import { toPublicQuiz } from "@/lib/quiz";
import { pagesFromChunks } from "@/lib/chunking";

/** GET /api/documents/[id] — document + study material + quizzes. */
export const GET = withErrors(async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { id } = await params;
  const store = await getStore(user.id);
  const document = await store.getDocument(id);
  if (!document || document.userId !== user.id) {
    return err("Document not found.", 404);
  }

  const [material, quizzes, chunks] = await Promise.all([
    store.getMaterial(id),
    store.listQuizzes(id),
    store.getChunks(id),
  ]);

  return Response.json({
    document,
    material,
    quizzes: quizzes.map(toPublicQuiz),
    pages: pagesFromChunks(chunks),
    demoMode: !hasOpenAI(),
    temporaryStorage: !hasSupabase(),
  });
});
