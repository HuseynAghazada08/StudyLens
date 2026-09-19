import { randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { samplePdf } from "../src/lib/sample";
import type { Quiz, QuizResult } from "../src/lib/types";
import type { BrowserDocument } from "../src/lib/browser-store";

async function stored<T>(page: Page, table: "documents" | "quizzes" | "results"): Promise<T[]> {
  return page.evaluate(table => new Promise<T[]>((resolve, reject) => {
    const open = indexedDB.open("studylens-demo", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(table, "readonly");
      const request = transaction.objectStore(table).getAll();
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  }), table);
}

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
        await expect(page.getByRole("alert").filter({ hasText: "Cross-origin requests are not allowed." })).toBeVisible();
      } else {
        expect(response.status(), await response.text()).toBe(200);
        await expect(page.getByText("Document processed", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: action === "Choose PDF" ? "Preview upload.pdf" : "Cell Biology - StudyLens.pdf" })).toBeVisible();
      }
    });
  }
}

for (const action of ["Choose PDF", "Try sample PDF"]) {
  test(`browser persistence: ${action} survives refresh without backend document state`, async ({ page, context }) => {
    await page.goto(`${base}/dashboard`);
    if (action === "Choose PDF") {
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: action, exact: true }).click();
      await (await chooser).setFiles({ name: "Persistent notes.pdf", mimeType: "application/pdf", buffer: Buffer.from(samplePdf()) });
    } else await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByText("Document processed", { exact: true })).toBeVisible();
    const url = page.url();
    const remoteRequests: string[] = [];
    await context.route(/\/api\/(documents|quizzes)(\/|$)/, route => { remoteRequests.push(route.request().url()); return route.abort(); });
    await context.clearCookies();
    await page.reload();
    await expect(page.getByText("One-minute summary", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "p.2", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toContainText("Photosynthesis");
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Quiz", exact: true }).click();
    await page.getByRole("button", { name: "5", exact: true }).click();
    await page.getByRole("button", { name: "Generate Quiz", exact: true }).click();
    await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: /Submit/ }).click();
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Quiz", exact: true }).click();
    await page.getByRole("button", { name: "View last result" }).click();
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Practice My Weak Topics" }).click();
    await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Ask PDF" }).click();
    await page.getByRole("textbox", { name: "Ask a question about the document" }).fill("What is photosynthesis?");
    await page.getByRole("button", { name: "Send question" }).click();
    await expect(page.getByText(/Based on the document:/)).toBeVisible();
    const anotherTab = await context.newPage();
    await anotherTab.goto(url);
    await expect(anotherTab.getByText("Document processed", { exact: true })).toBeVisible();
    await page.goto(`${base}/dashboard`);
    await expect(page.getByRole("link", { name: action === "Choose PDF" ? /Persistent notes.pdf/ : /Cell Biology - StudyLens.pdf/ })).toBeVisible();
    expect(remoteRequests).toEqual([]);
  });
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
  const original = (await stored<Quiz>(page, "quizzes"))[0];
  const result = (await stored<QuizResult>(page, "results"))[0];
  await page.getByRole("button", { name: "Practice My Weak Topics" }).click();
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ask PDF" }).click();
  await page.getByRole("textbox", { name: "Ask a question about the document" }).fill("What is photosynthesis?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText(/Based on the document:/)).toBeVisible();
  await page.getByRole("textbox", { name: "Ask a question about the document" }).fill("Who won the Wimbledon tennis championship?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("Not found in document", { exact: true })).toBeVisible();
  const detail = (await stored<BrowserDocument>(page, "documents")).find(d => d.document.id === id)!;
  expect(detail.pages).toHaveLength(4);
  const practice = (await stored<Quiz>(page, "quizzes")).find(q => q.parentQuizId === original.id)!;
  expect(practice.questions.every(q => result.weakTopics.some(t => t.topic === q.topic))).toBeTruthy();
  expect((await page.request.get(`${base}/api/documents/${id}`)).status()).toBe(404);
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.screenshot({ path: info.outputPath("workspace-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Summary", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath("workspace-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("demo upload is stateless and does not expose stored documents through API routes", async ({ request }) => {
  const upload = await request.post(`${base}/api/documents`, { multipart: { file: { name: "sample.pdf", mimeType: "application/pdf", buffer: Buffer.from(samplePdf()) } } });
  expect(upload.ok()).toBeTruthy();
  const { documentId, browserDocument } = await upload.json();
  expect(browserDocument.document.id).toBe(documentId);
  expect(browserDocument.pages).toHaveLength(4);
  expect(browserDocument.material.oneMinuteSummary).toBeTruthy();
  expect(upload.headers()["set-cookie"]).toBeUndefined();
  expect((await (await request.get(`${base}/api/documents`)).json()).documents).toEqual([]);
  expect((await request.get(`${base}/api/documents/${documentId}`)).status()).toBe(404);
  expect((await request.post(`${base}/api/documents/${documentId}/quiz`, { data: {} })).status()).toBe(404);
});

test("saved demo sessions are browser-isolated and correct answers receive full credit", async ({ page, browser }) => {
  await page.goto(`${base}/dashboard`);
  await page.getByRole("button", { name: "Try sample PDF" }).click();
  await expect(page.getByText("Document processed", { exact: true })).toBeVisible();
  const isolated = await browser.newContext();
  const visitor = await isolated.newPage();
  await visitor.goto(page.url());
  await expect(visitor.getByRole("alert").filter({ hasText: "not saved in this browser" })).toBeVisible();
  await isolated.close();
  await page.getByRole("tab", { name: "Quiz", exact: true }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Multiple choice", exact: true }).click();
  await page.getByRole("button", { name: "Generate Quiz", exact: true }).click();
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  const quiz = (await stored<Quiz>(page, "quizzes"))[0];
  for (let i = 0; i < quiz.questions.length; i++) {
    await page.getByRole("button", { name: new RegExp(`^[A-D] ${quiz.questions[i].correctAnswer}$`) }).click();
    if (i < quiz.questions.length - 1) await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: /Submit/ }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  expect((await stored<QuizResult>(page, "results"))[0].score).toBe(5);
});

test("unavailable browser storage shows an error instead of navigating to a missing document", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { get: () => undefined }));
  await page.goto(`${base}/dashboard`);
  await page.getByRole("button", { name: "Try sample PDF" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Browser storage is unavailable" })).toBeVisible();
  await expect(page).toHaveURL(`${base}/dashboard`);
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
