"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, UploadCloud, Sparkles } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type Phase = "idle" | "uploading" | "analyzing" | "error";

/**
 * Drag-and-drop / click-to-upload PDF zone. Uploads to /api/documents and
 * navigates to the new document workspace when analysis completes.
 */
export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const locked = useRef(false);
  const busy = phase === "uploading" || phase === "analyzing";

  const upload = async (file: File) => {
    if (locked.current) return;
    locked.current = true;
    setError(null);
    setFileName(file.name);
    setPhase("uploading");
    try {
      if (!file.name.toLowerCase().endsWith(".pdf") || !["application/pdf", "application/octet-stream", ""].includes(file.type)) throw new Error("Please choose a PDF file.");
      if (file.size > 4 * 1024 * 1024) throw new Error("Please choose a PDF smaller than 4 MB.");
      const form = new FormData();
      form.append("file", file);
      const data = await new Promise<{ documentId: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/documents");
        xhr.timeout = 310000;
        xhr.upload.onload = () => setPhase("analyzing");
        xhr.onerror = () => reject(new Error("Network error. Please retry."));
        xhr.ontimeout = () => reject(new Error("Processing timed out. Check your document list before uploading again."));
        xhr.onload = () => {
          try {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status < 200 || xhr.status >= 300 || !result.documentId) throw new Error(result.error ?? "Upload failed.");
            resolve(result);
          } catch (e) { reject(e instanceof Error ? e : new Error("Unexpected server response.")); }
        };
        xhr.send(form);
      });
      router.push(`/documents/${data.documentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setPhase("error");
    } finally { locked.current = false; if (inputRef.current) inputRef.current.value = ""; }
  };

  const sample = async () => {
    setPhase("uploading"); setFileName("Cell Biology - StudyLens.pdf");
    try {
      const response = await fetch("/api/sample");
      if (!response.ok) throw new Error("Could not load the sample PDF.");
      await upload(new File([await response.blob()], "Cell Biology - StudyLens.pdf", { type: "application/pdf" }));
    } catch { setError("Could not load the sample PDF. Please retry."); setPhase("error"); }
  };

  return (
    <Card className={cn("relative overflow-hidden border-2 border-dashed p-6 text-center transition-colors sm:p-10", dragOver ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30" : "border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white dark:border-indigo-900 dark:from-indigo-950/30 dark:to-stone-900")}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); if (!busy && e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0]); }}>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) void upload(e.target.files[0]); }} aria-label="Choose a PDF file" />
      {busy ? <div className="flex flex-col items-center gap-4 py-6" role="status"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /><p className="max-w-full truncate font-medium">{fileName}</p><p className="text-sm text-stone-500">{phase === "uploading" ? "Uploading your PDF…" : "Reading pages and building your study session…"}</p><p className="text-xs text-stone-400">Text extraction → cited notes → ready to learn</p></div> : <div className="flex flex-col items-center gap-3">
        <div className="mb-2 rounded-2xl bg-white p-4 text-indigo-500 shadow-sm dark:bg-stone-800"><UploadCloud className="h-8 w-8" /></div>
        <h2 className="text-lg font-semibold">A little less reading. A lot more understanding.</h2>
        <p className="text-sm text-stone-500">Drop your lecture notes, chapter, or research paper here.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3"><Button onClick={() => inputRef.current?.click()}><FileUp className="h-4 w-4" />Choose PDF</Button><Button variant="secondary" onClick={sample}><Sparkles className="h-4 w-4" />Try sample PDF</Button></div>
        <p className="mt-2 text-xs text-stone-400">PDF only · up to 4 MB · 80 pages · text-based documents</p>
        <p className="max-w-md text-xs leading-5 text-stone-400">When AI is enabled, extracted passages are sent to OpenAI. Avoid uploading sensitive personal information.</p>
      </div>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
    </Card>
  );
}
