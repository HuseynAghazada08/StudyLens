import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { env, hasSupabase } from "../env";

/**
 * Session-scoped Supabase client for server components / route handlers.
 * Uses the user's JWT from cookies so RLS policies apply.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — session refresh is handled by proxy.ts.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Returns the signed-in user, or a synthetic demo user when Supabase
 * isn't configured so the app stays usable in demo mode.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!hasSupabase()) {
    const jar = await cookies();
    const global = globalThis as typeof globalThis & { demoSigningKey?: string };
    const key = process.env.DEMO_SESSION_SECRET || (global.demoSigningKey ??= randomBytes(32).toString("hex"));
    const sign = (id: string) => createHmac("sha256", key).update(id).digest("hex");
    const [storedId, signature] = (jar.get("studylens-demo")?.value ?? "").split(".");
    let id = storedId;
    const valid = id && /^[a-f0-9]{48}$/.test(id) && signature?.length === 64 && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id)));
    if (!valid) {
      id = randomBytes(24).toString("hex");
      const secure = Boolean(process.env.VERCEL) || (await headers()).get("x-forwarded-proto") === "https";
      jar.set("studylens-demo", `${id}.${sign(id)}`, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 86400 });
    }
    return { id, email: null };
  }
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
