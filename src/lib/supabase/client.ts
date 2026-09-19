import { createBrowserClient } from "@supabase/ssr";


/** Browser-side Supabase client used by the login form. */
export function createSupabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
