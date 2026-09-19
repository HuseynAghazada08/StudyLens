/**
 * Client-safe environment checks — only NEXT_PUBLIC_* vars are read here,
 * so this module is safe to import from browser code.
 */
export const hasSupabase =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http") &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").length > 0;
