export const env = {
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  maxUploadMb: 4,
};

/** True when an OpenAI key is configured — enables AI-powered generation. */
export const hasOpenAI = () => env.openaiKey.length > 0;

/** True when Supabase credentials are configured — enables real auth + persistence. */
export const hasSupabase = () =>
  env.supabaseUrl.startsWith("http") && env.supabaseAnonKey.length > 0;

/**
 * Demo mode keeps the whole product usable without credentials:
 * in-memory storage, no login wall, extractive (non-AI) study material.
 */
export const isDemoMode = () => !hasOpenAI() || !hasSupabase();
