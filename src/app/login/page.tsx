"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/env-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hasSupabase) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="mb-4 text-stone-600 dark:text-stone-300">
            StudyLens is running in demo mode — no sign-in required.
          </p>
          <Button onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error: authError } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (authError) throw new Error(authError.message);
      if (mode === "signup" && !data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Authentication failed. Please retry."); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md p-8">
        <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          StudyLens
        </Link>

        <h1 className="mb-1 text-xl font-semibold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
          {mode === "signin"
            ? "Sign in to access your documents."
            : "Sign up to start studying."}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-stone-300 bg-transparent px-3 py-2 outline-none focus:border-indigo-500 dark:border-stone-700"
              placeholder="you@university.edu"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-stone-300 bg-transparent px-3 py-2 outline-none focus:border-indigo-500 dark:border-stone-700"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {message}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg">
            {mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </Card>
    </div>
  );
}
