import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hasOpenAI } from "@/lib/env";
import { analyzeDocument } from "@/lib/analysis";
import { demoAnalyze } from "@/lib/demo";
import { pagesFromChunks } from "@/lib/chunking";

export const maxDuration = 300;

export const POST = withErrors(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(true);
  if (isResponse(user)) return user;
  const { id } = await params;
  const store = await getStore(user.id);
  const doc = await store.getDocument(id);
  if (!doc || doc.userId !== user.id) return err("Document not found.", 404);
  if (doc.status === "processing" && Date.now() - Date.parse(doc.createdAt) < 300000) return err("Analysis is still running. Please wait.", 409);
  const chunks = await store.getChunks(id);
  if (!chunks.length) return err("No extracted text was saved. Please upload the PDF again.", 409);
  await store.setDocumentStatus(id, "processing");
  try {
    const material = hasOpenAI() ? await analyzeDocument(chunks) : demoAnalyze(pagesFromChunks(chunks), chunks);
    await store.saveMaterial(id, material);
    await store.setDocumentStatus(id, "ready");
  } catch {
    await store.setDocumentStatus(id, "error", "Analysis could not finish. Check your API quota and retry.");
    return err("Analysis failed. Please check your API configuration and retry.", 502);
  }
  return Response.json({ documentId: id });
});
