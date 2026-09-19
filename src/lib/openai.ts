import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { env, hasOpenAI } from "./env";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey, timeout: 45000, maxRetries: 1 });
  return client;
}

interface ChatJSONOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Calls the model in JSON mode and validates the response with zod.
 * On malformed output it retries once with a repair instruction, then throws.
 */
export async function chatJSON<T>({
  system,
  user,
  schema,
  temperature = 0.4,
  maxTokens = 4096,
}: ChatJSONOptions<T>): Promise<T> {
  if (!hasOpenAI()) throw new Error("OPENAI_API_KEY is not configured");

  const openai = getClient();
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: env.openaiModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    try {
      return schema.parse(JSON.parse(raw));
    } catch {
      // Feed the broken output back so the model can repair it.
      messages.push(
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "That response was not valid JSON matching the required schema. Return ONLY the corrected JSON object, nothing else.",
        }
      );
    }
  }

  throw new Error("The model returned malformed JSON twice");
}
