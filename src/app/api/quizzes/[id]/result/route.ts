import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { getStore } from "@/lib/store";

export const GET = withErrors(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { id } = await params;
  const store = await getStore(user.id);
  const quiz = await store.getQuiz(id);
  if (!quiz || quiz.userId !== user.id) return err("Quiz not found.", 404);
  const result = await store.getLatestAttempt(id);
  return result ? Response.json(result) : err("No submitted attempt yet. Take this quiz first.", 404);
});
