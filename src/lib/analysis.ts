import { z } from "zod";
import { chatJSON } from "./openai";
import { rankChunks } from "./chunking";
import { FINAL_MATERIAL_SYSTEM, GROUNDING_RULES } from "./prompts";
import { groundedSchema, studyMaterialSchema } from "./validation";
import type { DocumentChunk, StudyMaterial, WeakTopic } from "./types";

/** Evenly samples items when there are more than `limit`. */
function sample<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  return Array.from({ length: limit }, (_, i) => items[Math.floor(i * items.length / limit)]);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

/**
 * Turns extracted chunks into StudyMaterial.
 * Small docs go to the model in one shot; large docs use a map-reduce pass
 * (per-chunk digests -> merged final material) so no prompt ever holds
 * the entire PDF.
 */
export async function analyzeDocument(chunks: DocumentChunk[]): Promise<StudyMaterial> {
  const makeMaterial = (source: DocumentChunk[]) => {
    const context = source.map(c => `Section: ${c.heading}\n${c.text}`).join("\n\n");
    return chatJSON({ system: FINAL_MATERIAL_SYSTEM, user: context, schema: groundedSchema(studyMaterialSchema, context), maxTokens: 5000 });
  };
  if (chunks.reduce((n, c) => n + c.text.length, 0) <= 16000) return makeMaterial(chunks);

  // Map: digest each sampled chunk.
  const selected = chunks;
  const materials = await mapWithConcurrency(selected, 3, c => makeMaterial([c]));
  const overviewSchema = z.object({ oneMinuteSummary: z.string().min(1).max(1500), detailedSummary: z.string().min(1).max(6000), summaryPages: z.array(z.number().int().positive()).min(1) });
  let digests = materials.map(m => ({ oneMinuteSummary: m.oneMinuteSummary, detailedSummary: m.detailedSummary, summaryPages: m.summaryPages }));

  // Reduce: merge digests into the final structured material.
  while (digests.length > 1) {
    const groups: typeof digests[] = [];
    let group: typeof digests = [];
    let size = 0;
    for (const digest of digests) {
      const length = JSON.stringify(digest).length;
      if (size + length > 16000 && group.length > 1) { groups.push(group); group = []; size = 0; }
      group.push(digest);
      size += length;
    }
    if (group.length) groups.push(group);
    digests = await mapWithConcurrency(groups, 3, async items => {
      if (items.length === 1) return items[0];
      const context = items.map(m => `${m.summaryPages.map(p => `[Page ${p}]`).join(" ")}\n${m.detailedSummary}`).join("\n\n");
      return chatJSON({
        system: `${GROUNDING_RULES}\nMerge these source-grounded summaries. Return JSON with oneMinuteSummary (under 80 words), detailedSummary (under 700 words), summaryPages (supporting page numbers).`,
        user: context,
        schema: groundedSchema(overviewSchema, context),
        maxTokens: 2000,
      });
    });
  }
  const unique = <T>(values: T[], key: (v: T) => string) => [...new Map(values.map(v => [key(v).toLowerCase(), v])).values()];
  return studyMaterialSchema.parse({
    ...digests[0],
    keyConcepts: unique(materials.flatMap(m => m.keyConcepts), c => c.name),
    keyTerms: unique(materials.flatMap(m => m.keyTerms), t => t.term),
    sectionSummaries: materials.flatMap(m => m.sectionSummaries),
    sectionNotes: materials.flatMap(m => m.sectionNotes),
  });
}

/** Picks the chunks most relevant to a query, falling back to an even sample. */
export function contextForQuery(chunks: DocumentChunk[], query: string, maxChunks = 4): DocumentChunk[] {
  const ranked = rankChunks(chunks, query, maxChunks);
  return ranked.length > 0 ? ranked : sample(chunks, Math.min(3, chunks.length));
}

/** Builds a context string for quiz generation, optionally biased to weak topics. */
export function contextForQuiz(material: StudyMaterial, chunks: DocumentChunk[], focusTopics?: WeakTopic[]): string {
  const focusPages = new Set(focusTopics?.flatMap(t => t.pages));
  const chosen = focusTopics?.length
    ? chunks.filter(c => [...focusPages].some(p => p >= c.pageStart && p <= c.pageEnd)).slice(0, 5)
    : sample(chunks, 5);
  if (!chosen.length) throw new Error("No source content is available for these topics.");
  const focus = focusTopics?.length
    ? `Only ask about these topics, using these exact topic labels: ${focusTopics.map(t => t.topic).join(", ")}.`
    : `Suggested topic labels: ${material.keyConcepts.slice(0, 20).map(c => c.name).join(", ")}.`;
  return `${focus}\n\n${chosen.map(c => c.text).join("\n\n")}`;
}
