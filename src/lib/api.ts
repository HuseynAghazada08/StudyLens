import { headers } from "next/headers";
import { hasOpenAI, hasSupabase } from "./env";
import { isAllowedOrigin } from "./origin";
import { getSessionUser, type SessionUser } from "./supabase/server";

export function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Returns the session user or a 401 Response to send back. */
export async function requireUser(costly = false): Promise<SessionUser | Response> {
  const h = await headers();
  const origin = h.get("origin");
  const development = process.env.NODE_ENV === "development";
  const protocol = h.get("x-forwarded-proto") ?? (development ? "http" : "https");
  if (!isAllowedOrigin(origin, h.get("host"), protocol, development)) return err("Cross-origin requests are not allowed.", 403);
  if (process.env.VERCEL && hasOpenAI() && !hasSupabase()) return err("Configure Supabase authentication before enabling AI on a public deployment.", 503);
  const user = await getSessionUser();
  if (!user) return err("You must be signed in.", 401);
  if (costly) {
    const global = globalThis as typeof globalThis & { studyLimits?: Map<string, { count: number; reset: number }> };
    const limits = global.studyLimits ??= new Map();
    const now = Date.now();
    for (const [key, value] of limits) if (value.reset <= now) limits.delete(key);
    const limit = limits.get(user.id) ?? { count: 0, reset: now + 60000 };
    if (limit.count >= 20) return err("Too many requests. Please wait a minute before trying again.", 429);
    limits.set(user.id, { ...limit, count: limit.count + 1 });
  }
  return user;
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}

export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      const response = await handler(...args);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch {
      return err("This operation could not be completed. Please retry. If it persists, check your server configuration and API quota.", 502);
    }
  };
}
