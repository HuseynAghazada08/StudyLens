import assert from "node:assert/strict";
import test from "node:test";
import { buildChunks, pagesFromChunks } from "../src/lib/chunking";
import { demoAnalyze, demoQuiz, demoAsk, demoGradeShort } from "../src/lib/demo";
import { questionSchema, groundedSchema, askAnswerSchema } from "../src/lib/validation";
import { extractPdfPages } from "../src/lib/pdf";
import { samplePdf } from "../src/lib/sample";
import { isAllowedOrigin } from "../src/lib/origin";

test("development allows localhost and 127.0.0.1 preview origins on dynamic ports", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000"]) {
    for (const origin of ["http://localhost:49152", "http://127.0.0.1:53982", "https://localhost:61000", "https://127.0.0.1:65535"]) {
      assert.equal(isAllowedOrigin(origin, host, "http", true), true, `${origin} -> ${host}`);
      assert.equal(isAllowedOrigin(origin, host, "http", false), false, `${origin} must be rejected in production`);
    }
  }
});

test("production requires the same scheme, hostname and port", () => {
  assert.equal(isAllowedOrigin("https://study.example", "study.example", "https", false), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3000", "127.0.0.1:3000", "http", false), true);
  for (const origin of ["http://study.example", "https://study.example:3000", "https://other.example", "http://localhost:3000"]) {
    assert.equal(isAllowedOrigin(origin, "study.example", "https", false), false, origin);
  }
  assert.equal(isAllowedOrigin(null, "study.example", "https", false), true);
});

test("origin validation rejects malformed, opaque, lookalike and non-HTTP origins in every mode", () => {
  for (const development of [true, false]) {
    for (const origin of ["", "null", "not a URL", "file://localhost", "ftp://127.0.0.1", "http://localhost.attacker.example:3000", "http://127.0.0.1.attacker.example", "http://localhost@attacker.example", "http://user:password@localhost:4000", "http://localhost:4000/path", "http://localhost:4000?query", "http://localhost:4000#fragment", "http://192.168.1.1:3000"]) {
      assert.equal(isAllowedOrigin(origin, "127.0.0.1:3000", "http", development), false, origin);
    }
  }
});

test("sample PDF extraction preserves all four page numbers", async () => {
  const bytes = new Uint8Array(samplePdf());
  const result = await extractPdfPages(bytes.buffer);
  assert.deepEqual(result.map(p => p.page), [1, 2, 3, 4]);
  assert.match(result[1].text, /Photosynthesis/);
  assert.match(result[3].text, /Meiosis/);
});

test("chunk reconstruction preserves the complete source", () => {
  const input = [{ page: 1, text: "biology ".repeat(2000) }, { page: 2, text: "" }];
  assert.deepEqual(pagesFromChunks(buildChunks(input, 1000)), input);
});

test("invalid model citations and inconsistent not-found responses are rejected", () => {
  const schema = groundedSchema(askAnswerSchema, "[Page 2] Evidence");
  assert.equal(schema.safeParse({ answer: "Answer", pages: [99], foundInDocument: true }).success, false);
  assert.equal(schema.safeParse({ answer: "Answer", pages: [], foundInDocument: true }).success, false);
  assert.equal(schema.safeParse({ answer: "Not found", pages: [2], foundInDocument: false }).success, false);
  assert.equal(schema.safeParse({ answer: "Not found", pages: [], foundInDocument: false }).success, true);
});

test("demo Q&A declines unrelated topics and short-answer grading rejects sparse guesses", () => {
  const chunks = buildChunks([{ page: 1, text: "Photosynthesis is the conversion of light energy into chemical energy." }]);
  assert.equal(demoAsk(chunks, "Who won Wimbledon?").foundInDocument, false);
  assert.equal(demoGradeShort("conversion of light energy into chemical energy", "energy"), false);
  assert.equal(demoGradeShort("chlorophyll", "chlorophyll"), true);
});

const pages = [
  { page: 1, text: "Photosynthesis is the conversion of light energy into chemical energy. Chlorophyll is the pigment that absorbs light in plant cells. Glucose is a sugar produced during photosynthesis. Oxygen is a gas released during photosynthesis." },
  { page: 2, text: "Respiration is the process that releases energy from glucose. Mitochondria are organelles where aerobic respiration occurs. ATP is the molecule that transfers energy in cells. Glycolysis is the breakdown of glucose in the cytoplasm." },
];

test("dense pages respect the chunk size including page markers", () => {
  const chunks = buildChunks([{ page: 7, text: "long text ".repeat(2000) }], 1000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(c => c.text.length <= 1000 && c.pageStart === 7 && c.pageEnd === 7));
});

test("weak-topic practice contains only the missed topic", () => {
  const chunks = buildChunks(pages);
  const material = demoAnalyze(pages, chunks);
  const quiz = demoQuiz(pages, chunks, material, { questionCount: 5, type: "mixed", difficulty: "medium" }, [{ topic: "Respiration", pages: [2] }]);
  assert.equal(quiz.length, 5);
  assert.ok(quiz.every(q => q.topic === "Respiration" && q.pages.every(p => p === 2)));
});

test("questions reject absent evidence and invalid answer choices", () => {
  const invalid = { type: "multiple_choice", question: "What?", options: ["A", "B"], correctAnswer: "C", explanation: "Because", difficulty: "easy", topic: "Topic", pages: [] };
  assert.equal(questionSchema.safeParse(invalid).success, false);
});

test("all demo quiz types produce the requested count from ordinary prose", () => {
  const prose = [{ page: 1, text: "Plants absorb light through their leaves. They use this energy to produce sugar from water and carbon dioxide. The roots absorb water from surrounding soil. Stomata allow gas exchange through tiny pores in leaves. Light availability affects the rate of sugar production." }];
  const chunks = buildChunks(prose);
  const material = demoAnalyze(prose, chunks);
  for (const type of ["multiple_choice", "true_false", "short_answer", "mixed"] as const) {
    const quiz = demoQuiz(prose, chunks, material, { questionCount: 5, type, difficulty: "easy" });
    assert.equal(quiz.length, 5, type);
    quiz.forEach(q => assert.ok(questionSchema.safeParse(q).success, JSON.stringify(q)));
  }
});
