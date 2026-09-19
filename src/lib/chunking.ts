import type { DocumentChunk, PageText } from "./types";

const MAX_CHUNK_CHARS = 6000;

/**
 * Guess a heading for a chunk from the first lines of its first page.
 * Falls back to a page-range label when nothing looks like a heading.
 */
function guessHeading(firstPageText: string, pageStart: number, pageEnd: number): string {
  const fallback =
    pageStart === pageEnd ? `Page ${pageStart}` : `Pages ${pageStart}–${pageEnd}`;
  const lines = firstPageText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);

  for (const line of lines) {
    const looksLikeHeading =
      line.length >= 4 &&
      line.length <= 90 &&
      (/^\d+(\.\d+)*[\s.)]/.test(line) || // "1.2 Intro" / "3) Methods"
        /^[A-Z][A-Z\s\-:&]{3,}$/.test(line) || // ALL CAPS
        /^[A-Z][a-zA-Z].*/.test(line)); // title-ish first line
    if (looksLikeHeading) return line.replace(/\s+/g, " ");
  }
  return fallback;
}

/**
 * Groups consecutive pages into ~6k-char chunks, preserving page ranges.
 * Chunks are the unit sent to the model — we never dump a whole large PDF
 * into one prompt.
 */
export function buildChunks(pages: PageText[], maxChars = MAX_CHUNK_CHARS): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  if (maxChars < 100) throw new Error("Chunk budget must be at least 100 characters.");
  for (const page of pages) {
    const marker = `[Page ${page.page}]\n`;
    const budget = maxChars - marker.length;
    let remaining = page.text;
    do {
      let end = Math.min(remaining.length, budget);
      if (end < remaining.length) {
        const boundary = remaining.lastIndexOf(" ", end);
        if (boundary > budget / 2) end = boundary + 1;
      }
      chunks.push({
        pageStart: page.page,
        pageEnd: page.page,
        heading: guessHeading(page.text, page.page, page.page),
        text: marker + remaining.slice(0, end),
      });
      remaining = remaining.slice(end);
    } while (remaining.length);
  }

  return chunks;
}

const STOP_WORDS = new Set(
  "the a an and or of to in is are was were for on with as by at from that this it be have has not but what which who when where how why can could should would do does did document pdf tell about explain describe please".split(
    " "
  )
);

function keywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    ),
  ];
}

/**
 * Lightweight lexical retrieval: scores chunks by keyword overlap with the
 * query and returns the top-k. Good enough to ground Ask-PDF answers and
 * weak-topic quizzes without a vector database.
 */
export function rankChunks(
  chunks: DocumentChunk[],
  query: string,
  topK = 4
): DocumentChunk[] {
  const qWords = new Set(keywords(query));
  if (qWords.size === 0) return [];

  return chunks
    .map((chunk) => {
      const words = keywords(chunk.text);
      let score = 0;
      for (const w of words) if (qWords.has(w)) score++;
      // Small bonus when the heading itself matches.
      for (const w of keywords(chunk.heading)) if (qWords.has(w)) score += 5;
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((s) => s.score > 0)
    .map((s) => s.chunk);
}

export function pagesFromChunks(chunks: DocumentChunk[]): PageText[] {
  const pages = new Map<number, string[]>();
  for (const chunk of chunks) {
    const parts = chunk.text.split(/\[Page (\d+)\]\n/);
    for (let i = 1; i + 1 < parts.length; i += 2) {
      const page = Number(parts[i]);
      pages.set(page, [...(pages.get(page) ?? []), parts[i + 1]]);
    }
  }
  return [...pages].sort(([a], [b]) => a - b).map(([page, text]) => ({ page, text: text.join("") }));
}

/** Truncate text with a hard cap to stay inside token budgets. */
export function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars) + "…";
}
