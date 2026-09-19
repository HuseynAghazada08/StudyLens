import { samplePdf } from "@/lib/sample";

export function GET() {
  return new Response(new Uint8Array(samplePdf()), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Cell Biology - StudyLens.pdf"' } });
}
