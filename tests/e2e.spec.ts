import { randomInt } from "node:crypto";
import { test, expect } from "@playwright/test";
import { samplePdf } from "../src/lib/sample";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
test.setTimeout(90000);

for (const hostname of ["localhost", "127.0.0.1"]) {
  for (const action of ["Choose PDF", "Try sample PDF"]) {
    test(`preview uploads: ${action} from ${hostname} on a dynamic port`, async ({ page }) => {
      const origin = `http://${hostname}:${randomInt(40000, 65000)}`;
      await page.route("**/api/documents", route => route.continue({ headers: { ...route.request().headers(), origin } }));
      await page.goto(`${base}/dashboard`);
      await expect(page.getByRole("button", { name: action, exact: true })).toBeVisible();
      const uploaded = page.waitForResponse(r => r.url().endsWith("/api/documents") && r.request().method() === "POST");
      if (action === "Choose PDF") {
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: action, exact: true }).click();
        await (await chooser).setFiles({ name: "Preview upload.pdf", mimeType: "application/pdf", buffer: Buffer.from(samplePdf()) });
      } else {
        await page.getByRole("button", { name: action, exact: true }).click();
      }
      const response = await uploaded;
      expect((await response.request().allHeaders()).origin).toBe(origin);
      expect(new URL(origin).host).not.toBe(new URL(base).host);
      if (process.env.TEST_SERVER_MODE === "production") {
        expect(response.status()).toBe(403);
        await expect(page.getByRole("alert")).toHaveText("Cross-origin requests are not allowed.");
      } else {
        expect(response.status(), await response.text()).toBe(200);
        await expect(page.getByText("Document processed", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: action === "Choose PDF" ? "Preview upload.pdf" : "Cell Biology - StudyLens.pdf" })).toBeVisible();
      }
    });
  }
}

test("Choose PDF uploads through the browser file picker", async ({ page }) => {
  await page.goto(`${base}/dashboard`);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose PDF", exact: true }).click();
  await (await chooser).setFiles({ name: "Chosen study notes.pdf", mimeType: "application/pdf", buffer: Buffer.from(samplePdf()) });
  await expect(page.getByRole("heading", { name: "Chosen study notes.pdf" })).toBeVisible();
  await expect(page.getByText("Document processed", { exact: true })).toBeVisible();
});

test("complete demo: upload, sources, quiz, adaptive practice and cited chat", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${base}/dashboard`);
  await expect(page.getByText("No documents yet")).toBeVisible();
  await page.getByRole("button", { name: "Try sample PDF" }).click();
  await expect(page.getByRole("heading", { name: "Cell Biology - StudyLens.pdf" })).toBeVisible();
  await expect(page.getByText("Document processed", { exact: true })).toBeVisible();
  const id = page.url().split("/").pop()!;
  await page.getByRole("button", { name: "p.2", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Photosynthesis");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({ path: info.outputPath("workspace-desktop.png"), fullPage: true });
  await page.getByRole("tab", { name: "Quiz", exact: true }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Generate Quiz", exact: true }).click();
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Study Notes" }).click();
  await page.getByRole("tab", { name: "Quiz", exact: true }).click();
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /Submit/ }).click();
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  await expect(page.getByText("Answer review", { exact: true })).toBeVisible();
  const practiceResponse = page.waitForResponse(r => r.url().endsWith("/practice") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Practice My Weak Topics" }).click();
  expect((await practiceResponse).ok()).toBeTruthy();
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ask PDF" }).click();
  await page.getByRole("textbox", { name: "Ask a question about the document" }).fill("What is photosynthesis?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText(/Based on the document:/)).toBeVisible();
  await page.getByRole("textbox", { name: "Ask a question about the document" }).fill("Who won the Wimbledon tennis championship?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("Not found in document", { exact: true })).toBeVisible();
  const detail = await (await page.request.get(`${base}/api/documents/${id}`)).json();
  expect(detail.pages).toHaveLength(4);
  for (const quiz of detail.quizzes) for (const question of quiz.questions) {
    expect(question).not.toHaveProperty("correctAnswer");
    expect(question).not.toHaveProperty("explanation");
  }
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.screenshot({ path: info.outputPath("workspace-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Summary", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath("workspace-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("API enforces ownership, hides answer keys, and derives practice from saved results", async ({ playwright }) => {
  const owner = await playwright.request.newContext();
  const other = await playwright.request.newContext();
  await owner.get(`${base}/api/documents`);
  const upload = await owner.post(`${base}/api/documents`, { multipart: { file: { name: "sample.pdf", mimeType: "application/pdf", buffer: Buffer.from(samplePdf()) } } });
  expect(upload.ok()).toBeTruthy();
  const { documentId } = await upload.json();
  expect((await other.get(`${base}/api/documents/${documentId}`)).status()).toBe(404);
  const { quiz } = await (await owner.post(`${base}/api/documents/${documentId}/quiz`, { data: { questionCount: 5, difficulty: "easy", type: "multiple_choice" } })).json();
  expect(quiz.questions).toHaveLength(5);
  const result = await (await owner.post(`${base}/api/quizzes/${quiz.id}/submit`, { data: { answers: quiz.questions.map((q: { id: string }) => ({ questionId: q.id, answer: "" })) } })).json();
  expect(result.score).toBe(0);
  const focused = await owner.post(`${base}/api/quizzes/${quiz.id}/practice`, { data: { attemptId: result.attemptId, weakTopics: [{ topic: "Invented topic", pages: [999] }] } });
  expect(focused.ok()).toBeTruthy();
  const practice = (await focused.json()).quiz;
  expect(practice.parentQuizId).toBe(quiz.id);
  expect(practice.questions.every((q: { topic: string }) => result.weakTopics.some((t: { topic: string }) => t.topic === q.topic))).toBeTruthy();
  expect((await other.post(`${base}/api/quizzes/${quiz.id}/submit`, { data: { answers: quiz.questions.map((q: { id: string }) => ({ questionId: q.id, answer: "" })) } })).status()).toBe(404);
  const perfect = await owner.post(`${base}/api/quizzes/${quiz.id}/submit`, { data: { answers: result.answers.map((a: { questionId: string; correctAnswer: string }) => ({ questionId: a.questionId, answer: a.correctAnswer })) } });
  expect((await perfect.json()).score).toBe(5);
  expect((await (await owner.get(`${base}/api/quizzes/${quiz.id}/result`)).json()).score).toBe(5);
  await owner.dispose(); await other.dispose();
});

test("rejects fake PDFs, oversized uploads, malformed bodies and cross-origin requests", async ({ request }) => {
  const fake = await request.post(`${base}/api/documents`, { multipart: { file: { name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") } } });
  expect(fake.status()).toBe(415);
  const big = await request.post(`${base}/api/documents`, { multipart: { file: { name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) } } });
  expect(big.status()).toBe(413);
  expect((await request.post(`${base}/api/documents`, { data: "bad json" })).status()).toBe(400);
  expect((await request.get(`${base}/api/documents`, { headers: { Origin: "https://untrusted.example" } })).status()).toBe(403);
});

test("landing is responsive and themes work", async ({ page }, info) => {
  await page.goto(base);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("personalized study session");
  await page.screenshot({ path: info.outputPath("landing-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.screenshot({ path: info.outputPath("landing-mobile.png"), fullPage: true });
});
