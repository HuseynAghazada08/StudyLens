import { extractText, getDocumentProxy } from "unpdf";
import type { PageText } from "./types";

/**
 * Extracts text per page so page numbers survive into citations.
 * unpdf wraps pdf.js in a serverless-friendly way (no worker / canvas needed).
 */
export async function extractPdfPages(data: ArrayBuffer): Promise<PageText[]> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  if (pdf.numPages > 80) throw new Error("This edition supports up to 80 pages. Upload one chapter at a time.");
  const { text, totalPages } = await extractText(pdf, { mergePages: false });

  const perPage: string[] = Array.isArray(text) ? text : [text];
  const pages: PageText[] = [];

  for (let i = 0; i < totalPages; i++) {
    const cleaned = (perPage[i] ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    pages.push({ page: i + 1, text: cleaned });
  }

  if (pages.every((p) => p.text.length === 0)) {
    throw new Error(
      "No extractable text found. This PDF may be scanned images — try a text-based PDF."
    );
  }

  return pages;
}
