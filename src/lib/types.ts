export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type Difficulty = "easy" | "medium" | "hard";
export type QuizTypeOption = QuestionType | "mixed";
export type DocumentStatus = "processing" | "ready" | "error";

export interface PageText {
  page: number;
  text: string;
}

export interface DocumentChunk {
  pageStart: number;
  pageEnd: number;
  heading: string;
  text: string;
}

export interface StudyDocument {
  id: string;
  userId: string;
  name: string;
  pageCount: number;
  status: DocumentStatus;
  error: string | null;
  createdAt: string;
}

export interface DocumentSectionRow {
  id: string;
  documentId: string;
  pageStart: number;
  pageEnd: number;
  heading: string;
  content: string;
  orderIndex: number;
}

export interface KeyConcept {
  name: string;
  description: string;
  pages: number[];
}

export interface KeyTerm {
  term: string;
  definition: string;
  pages: number[];
}

export interface SectionSummary {
  heading: string;
  pageStart: number;
  pageEnd: number;
  summary: string;
}

export interface SectionNotes {
  heading: string;
  pageStart: number;
  pageEnd: number;
  bullets: string[];
}

export interface StudyMaterial {
  summaryPages: number[];
  oneMinuteSummary: string;
  detailedSummary: string;
  keyConcepts: KeyConcept[];
  keyTerms: KeyTerm[];
  sectionSummaries: SectionSummary[];
  sectionNotes: SectionNotes[];
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  difficulty: Difficulty;
  topic: string;
  pages: number[];
}

export interface Quiz {
  id: string;
  documentId: string;
  userId: string;
  label: string;
  difficulty: Difficulty;
  type: QuizTypeOption;
  questionCount: number;
  questions: Question[];
  parentQuizId: string | null;
  createdAt: string;
}

/** Quiz shape sent to the client while taking — answers stay server-side. */
export type PublicQuestion = Omit<Question, "correctAnswer" | "explanation">;
export type PublicQuiz = Omit<Quiz, "questions"> & { questions: PublicQuestion[] };

export interface GradedAnswer {
  questionId: string;
  question: string;
  type: QuestionType;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  topic: string;
  pages: number[];
}

export interface WeakTopic {
  topic: string;
  pages: number[];
}

export interface QuizResult {
  attemptId: string;
  quizId: string;
  score: number;
  total: number;
  answers: GradedAnswer[];
  weakTopics: WeakTopic[];
}

export interface QuizConfig {
  questionCount: 5 | 10 | 15;
  difficulty: Difficulty;
  type: QuizTypeOption;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  pages?: number[];
  foundInDocument?: boolean;
}

export interface DocumentDetail {
  document: StudyDocument;
  material: StudyMaterial | null;
  quizzes: PublicQuiz[];
  pages: PageText[];
}
