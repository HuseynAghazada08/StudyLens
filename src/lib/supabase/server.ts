import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
  if (!hasSupabase()) return { id: "browser-demo", email: null };
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
