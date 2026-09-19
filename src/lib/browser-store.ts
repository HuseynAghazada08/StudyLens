import type { DocumentDetail, Quiz, QuizConfig, QuizResult, StudyMaterial, WeakTopic } from "./types";
import { buildChunks } from "./chunking";
import { demoAsk, demoGradeShort, demoQuiz } from "./demo";
import { uid } from "./utils";

export type BrowserDocument = Omit<DocumentDetail, "quizzes"> & { material: StudyMaterial };
type Table = "documents" | "quizzes" | "results";

async function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Browser storage is unavailable. Enable site storage to use the demo.");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("studylens-demo", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("documents", { keyPath: "document.id" });
      request.result.createObjectStore("quizzes", { keyPath: "id" });
      request.result.createObjectStore("results", { keyPath: "quizId" });
    };
    request.onerror = () => reject(new Error("Could not open browser storage. Check your browser privacy settings."));
    request.onblocked = () => reject(new Error("Close other StudyLens tabs, then retry the storage upgrade."));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}

async function transact<T>(table: Table, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(table, mode);
      const request = operation(transaction.objectStore(table));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(new Error(transaction.error?.name === "QuotaExceededError"
        ? "Browser storage is full. Free some site storage before uploading again."
        : "Could not save or read this study session. Check that browser storage is enabled."));
      transaction.onerror = () => { /* onabort rejects only after the transaction is rolled back. */ };
    });
  } finally { db.close(); }
}

export async function saveBrowserDocument(value: BrowserDocument): Promise<void> {
  await transact("documents", "readwrite", store => store.put(value));
}

export async function listBrowserDocuments() {
  const documents = await transact<BrowserDocument[]>("documents", "readonly", store => store.getAll());
  return documents.map(d => d.document).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function getBrowserDocument(id: string): Promise<BrowserDocument> {
  const value = await transact<BrowserDocument | undefined>("documents", "readonly", store => store.get(id));
  if (!value) throw new Error("This demo document is not saved in this browser. Return to the dashboard and upload it or try the sample again.");
  return value;
}

function publicQuiz(quiz: Quiz) {
  return { ...quiz, questions: quiz.questions.map(q => ({ id: q.id, type: q.type, question: q.question, options: q.options, difficulty: q.difficulty, topic: q.topic, pages: q.pages })) };
}

export async function loadBrowserDocument(id: string): Promise<DocumentDetail> {
  const document = await getBrowserDocument(id);
  const quizzes = await transact<Quiz[]>("quizzes", "readonly", store => store.getAll());
  return { ...document, quizzes: quizzes.filter(q => q.documentId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicQuiz) };
}

async function getQuiz(id: string): Promise<Quiz> {
  const quiz = await transact<Quiz | undefined>("quizzes", "readonly", store => store.get(id));
  if (!quiz) throw new Error("This quiz is not saved in this browser. Generate a new quiz.");
  return quiz;
}

export async function browserQuiz(documentId: string, config: QuizConfig, focus?: WeakTopic[], parentQuizId: string | null = null) {
  const { document, material, pages } = await getBrowserDocument(documentId);
  const questions = demoQuiz(pages, buildChunks(pages), material, config, focus);
  const quiz: Quiz = { ...config, id: uid(), documentId, userId: document.userId, label: focus?.length ? `Practice · ${focus.map(t => t.topic).join(", ")}` : `${config.difficulty} · ${questions.length} questions`, questions, questionCount: questions.length, parentQuizId, createdAt: new Date().toISOString() };
  await transact("quizzes", "readwrite", store => store.put(quiz));
  return { quiz: publicQuiz(quiz) };
}

export async function browserSubmit(quizId: string, submitted: { questionId: string; answer: string }[]): Promise<QuizResult> {
  const quiz = await getQuiz(quizId);
  const answers = quiz.questions.map(q => {
    const userAnswer = submitted.find(a => a.questionId === q.id)?.answer ?? "";
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const isCorrect = q.type === "short_answer" ? demoGradeShort(q.correctAnswer, userAnswer) : normalize(userAnswer) === normalize(q.correctAnswer);
    return { questionId: q.id, question: q.question, type: q.type, userAnswer, correctAnswer: q.correctAnswer, isCorrect, explanation: q.explanation, topic: q.topic, pages: q.pages };
  });
  const missed = new Map<string, { pages: Set<number>; count: number }>();
  for (const answer of answers.filter(a => !a.isCorrect)) {
    const topic = missed.get(answer.topic) ?? { pages: new Set<number>(), count: 0 };
    answer.pages.forEach(p => topic.pages.add(p)); topic.count++;
    missed.set(answer.topic, topic);
  }
  const weakTopics = [...missed].sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([topic, value]) => ({ topic, pages: [...value.pages].sort((a, b) => a - b) }));
  const result: QuizResult = { attemptId: uid(), quizId, score: answers.filter(a => a.isCorrect).length, total: answers.length, answers, weakTopics };
  await transact("results", "readwrite", store => store.put(result));
  return result;
}

export async function browserResult(quizId: string): Promise<QuizResult> {
  const result = await transact<QuizResult | undefined>("results", "readonly", store => store.get(quizId));
  if (!result) throw new Error("No submitted attempt yet. Take this quiz first.");
  return result;
}

export async function browserPractice(quizId: string, attemptId: string) {
  const [quiz, result] = await Promise.all([getQuiz(quizId), browserResult(quizId)]);
  if (result.attemptId !== attemptId) throw new Error("Reopen the latest result before practicing.");
  if (!result.weakTopics.length) throw new Error("No weak topics were found. Try a harder quiz.");
  return browserQuiz(quiz.documentId, { questionCount: quiz.questionCount >= 10 ? 10 : 5, difficulty: quiz.difficulty, type: quiz.type }, result.weakTopics, quizId);
}

export async function browserAsk(documentId: string, question: string) {
  const { pages } = await getBrowserDocument(documentId);
  return demoAsk(buildChunks(pages), question);
}
