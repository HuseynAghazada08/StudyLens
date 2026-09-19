"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, SendHorizonal } from "lucide-react";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";
import { PageCitation } from "@/components/PageCitation";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "What is the main argument of this document?",
  "Summarize the most important section for an exam.",
  "Which terms does the document define?",
];

export function AskTab({
  documentId,
  onNavigate,
}: {
  documentId: string;
  onNavigate?: (page: number) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || thinking) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setThinking(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not answer that.");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          pages: data.pages ?? [],
          foundInDocument: data.foundInDocument,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer that.");
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[28rem] flex-col gap-4">
      <Card className="flex flex-1 flex-col overflow-hidden">
        <div role="log" aria-label="Document conversation" aria-live="polite" className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" aria-hidden />}
                title="Ask anything about this PDF"
                hint="Answers come only from the document, with page citations."
              />
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 transition-colors hover:border-indigo-400 hover:text-indigo-700 dark:border-stone-700 dark:text-stone-300 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "self-end bg-indigo-600 text-white"
                      : "self-start bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {m.foundInDocument === false && (
                        <Badge tone="amber">Not found in document</Badge>
                      )}
                      <PageCitation pages={m.pages ?? []} onNavigate={onNavigate} />
                    </div>
                  )}
                </div>
              ))}
              {thinking && (
                <div className="self-start">
                  <Spinner label="Searching the document…" />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t border-stone-200 px-4 py-3 dark:border-stone-800"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            minLength={3}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the document…"
            aria-label="Ask a question about the document"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-stone-700"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            aria-label="Send question"
            className="rounded-xl bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            <SendHorizonal className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
