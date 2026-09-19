import { env, hasOpenAI, hasSupabase } from "@/lib/env";
import { err, isResponse, requireUser, withErrors } from "@/lib/api";
import { extractPdfPages } from "@/lib/pdf";
import { buildChunks } from "@/lib/chunking";
import { analyzeDocument } from "@/lib/analysis";
import { demoAnalyze } from "@/lib/demo";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

/** GET /api/documents — list the current user's documents. */
export const GET = withErrors(async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const store = await getStore(user.id);
  const documents = await store.listDocuments(user.id);
  return Response.json({ documents, demoMode: !hasOpenAI(), temporaryStorage: !hasSupabase() });
});

/**
 * POST /api/documents — multipart upload: validates the file, extracts
 * per-page text, chunks it, generates study material, and stores everything.
 */
export const POST = withErrors(async function POST(request: Request) {
  const user = await requireUser(true);
  if (isResponse(user)) return user;

  if (Number(request.headers.get("content-length")) > (env.maxUploadMb * 1024 * 1024 + 65536)) return err("Upload exceeds the 4 MB limit.", 413);
  let file: File;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File)) return err("No file field in the upload.");
    file = candidate;
  } catch {
    return err("Expected a multipart/form-data upload.");
  }

  const isPdf =
    ["application/pdf", "application/octet-stream", ""].includes(file.type) && file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return err("Only PDF files are supported.", 415);
  if (file.size > env.maxUploadMb * 1024 * 1024) {
    return err(`File exceeds the ${env.maxUploadMb} MB limit.`, 413);
  }
  if (file.size === 0) return err("The uploaded file is empty.");

  const store = await getStore(user.id);
  let pages;
  try {
    const bytes = await file.arrayBuffer();
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return err("This file does not contain a valid PDF header.", 415);
    pages = await extractPdfPages(bytes);
    if (pages.length > 80 || pages.reduce((n, p) => n + p.text.length, 0) > 160000) return err("This edition supports up to 80 pages and 160,000 text characters. Upload one chapter at a time.", 413);
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Could not read text from this PDF.",
      422
    );
  }

  const doc = await store.createDocument({
    userId: user.id,
    name: file.name,
    pageCount: pages.length,
  });

  try {
    const chunks = buildChunks(pages);
    await store.saveChunks(doc.id, chunks);
    const material = hasOpenAI()
      ? await analyzeDocument(chunks)
      : demoAnalyze(pages, chunks);

    await store.saveMaterial(doc.id, material);
    await store.setDocumentStatus(doc.id, "ready");
  } catch {
    const message = "Analysis could not finish. Retry below; if it persists, check the server API credentials and quota.";
    await store.setDocumentStatus(doc.id, "error", message);
    return Response.json({ documentId: doc.id, error: message });
  }

  return Response.json({ documentId: doc.id });
});
