# StudyLens

**Turn any PDF into a personalized study session.**

A responsive Next.js / TypeScript / Tailwind application with PDF extraction, cited study notes, adaptive quizzes, document Q&A, light/dark themes, and Supabase authentication and persistence. A fully local demo works without API credentials.

## Quick start

Use Node.js 22 LTS and npm.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`, choose **Upload Your PDF**, then **Try sample PDF**. This uploads a real, generated four-page cell-biology PDF through the same extraction and analysis pipeline as a user file. You can also upload your own text-based PDF.

No credentials are needed for this local demo. It uses extractive summaries, source-based recall quizzes, approximate keyword grading for short answers, and lexical retrieval for Q&A. It is clearly labeled **Offline demo**; these are not simulated OpenAI responses. Difficulty adjusts recall exercises rather than providing AI-level reasoning. Small documents or narrowly focused practice may reuse passages.

Without Supabase, documents, extracted pages, summaries, quizzes, and the latest quiz results are saved in **IndexedDB in the browser**. The PDF upload endpoint is stateless: it extracts the file and returns a document snapshot, which the browser commits before navigating. Subsequent document loading, quiz generation/grading, weak-topic practice, and Q&A use that snapshot locally. No server-memory record, session cookie, signing secret, or Supabase instance is required. This works on Vercel across cold starts and different serverless instances.

Browser storage is isolated by browser profile and origin. Reloads, new tabs on the same domain, and server restarts preserve the study session. Clearing site data, private-session termination, or browser storage eviction can remove it. Different Vercel preview URLs and devices have separate storage; document links are not shareable across them. Blocked/full storage produces an error instead of navigating to an unsaved document. Existing links from the old in-memory demo must be re-uploaded once because their server-only data was never persisted.

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values you want to use. Never commit `.env.local`.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-only OpenAI credential. Leave blank for extractive mode. |
| `OPENAI_MODEL` | JSON-capable Chat Completions model; defaults to `gpt-4o-mini`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key used for browser authentication. Never put a service-role key here. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database credential; required when Supabase is configured. |

Restart the development server after changing environment variables. `NEXT_PUBLIC_*` values are included at build time, so rebuild after changing them on a deployment.

Configuration combinations:
- Neither provider: no login, browser-persisted extractive study tools; works locally and on Vercel.
- Supabase only: real login and server-persisted storage, extractive study tools.
- OpenAI only: browser demo remains extractive; paid AI is not invoked without authenticated server mode.
- Both providers: authenticated AI workflow and server-persisted storage.

Paid AI routes on Vercel require Supabase authentication. Partial Supabase configuration is not supported; provide the URL, anon key, and server service-role key together.

## Supabase setup

1. Create a Supabase project.
2. Open its SQL editor and run the complete `supabase/migrations/0001_init.sql` file once on a new database. Alternatively, use the Supabase CLI to link your project and apply the migration with `supabase db push`.
3. Add the three Supabase variables to `.env.local`.
4. Enable the email/password provider in Authentication settings.
5. Set Authentication's Site URL to `http://localhost:3000` for local development. For deployment, update it to your deployed origin and allow the appropriate redirect URLs.
6. Start the app, sign up, follow the confirmation email if confirmation is enabled, then sign in.

Users live in Supabase's managed `auth.users` table. Application tables are:

- `documents`: owner, filename, page count, processing status and errors.
- `document_sections`: extracted chunks, page ranges and ordering.
- `summaries`: validated study material in JSON.
- `quizzes` / `questions`: quiz configuration and server-held answer keys.
- `quiz_attempts`: scores and full graded result snapshots.
- `answers`: submitted answers and correctness.
- `weak_topics`: missed topics and supporting pages.

All tables have RLS enabled. Public clients cannot write application tables or read the `questions` table. Authenticated users can read their own permitted rows. Server routes verify the user with `auth.getUser()`, enforce ownership, and use a server-only service-role client for mutations and answer-key access. Service-role access bypasses RLS, so preserve route ownership checks when extending the app.

Original PDF bytes are processed in memory and are not stored in a public bucket. Persisted source text retains page numbers. Clicking a citation opens an accessible source-text dialog, not a rendered page image. No storage bucket or vector extension is required.

## Study workflow

1. Upload a PDF or try the sample. File extension, MIME type, magic header, size, and extraction output are validated.
2. View the one-minute overview, detailed summary, concepts, definitions, collapsible section summaries, and section notes.
3. Choose 5, 10, or 15 questions; easy, medium, or hard; multiple choice, true/false, short answer, or mixed.
4. Navigate one question at a time. Unanswered questions count as incorrect on submission.
5. Review the score, every answer and explanation, cited source pages, and weak topics.
6. **Practice My Weak Topics** creates a fresh quiz using the latest saved attempt's missed topics, not a client-supplied topic list.
7. Ask PDF returns a grounded answer with citations, or explicitly reports that supporting information was not found.

Quiz and chat state remain intact when switching tabs. Previous quizzes can be retaken, and their latest submitted results can be reopened after a reload. Failed analyses can be retried using the saved extracted text.

## AI reliability and limits

- PDFs are split into chunks capped at 6,000 characters, including dense single pages; page numbers are retained.
- Small documents use a bounded prompt. Large documents analyze **every chunk**, then merge summaries through bounded hierarchical reduction. Notes retain all processed sections rather than silently sampling a large PDF.
- Q&A uses lexical retrieval of relevant chunks. General quizzes sample source chunks for coverage. Adaptive quizzes select the source pages associated with missed concepts.
- Every model call requests JSON. Zod validates shapes and semantic constraints, including question count, options, correct-answer membership, requested difficulty/type, and cited page membership. Invalid model output gets one repair attempt, then a safe error response.
- Answer keys and explanations are stripped from the quiz-taking view. In Supabase mode, answer keys stay server-side. The standalone browser demo stores its questions and answer keys locally for offline grading; it is a self-study tool, not a tamper-proof exam system. Objective questions are graded deterministically; AI short-answer grading receives the actual supporting passages.
- Prompts treat PDF text and student answers as untrusted data, not instructions.
- Page validation establishes that citations refer to supplied pages; it cannot prove every generated sentence is correct. Verify important claims in the source viewer. Retrieval can miss relevant passages, especially for synonyms or tables.
- Supported upload envelope: **4 MB, 80 pages, 160,000 extracted characters**. Larger documents should be split into chapters. The 4 MB cap leaves room for multipart overhead under Vercel's request-body limit.
- Text-based PDFs only. Scans without a text layer need OCR outside this app. Complex columns/tables and mathematical notation may extract imperfectly. Password-protected PDFs are not supported.
- Analysis/retry routes allow up to 300 seconds; other AI routes up to 60 seconds. Actual limits depend on your Vercel plan. No background job is assumed to survive after a request ends.
- Costly routes have a per-process, per-user limit of 20 requests per minute. For public scale, add a distributed quota or Vercel firewall rate rule and configure OpenAI spending limits. The local limiter is not a global multi-instance quota.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For real browser and API regression tests, start the app in another terminal **without provider credentials**, then:

```bash
npx playwright install chromium
npm run test:e2e
```

`TEST_BASE_URL` overrides `http://localhost:3000`. Set `TEST_SERVER_MODE=production` when testing a `next start` server: dynamic-port preview origins must then be rejected, while ordinary same-origin uploads still work. Tests cover both upload buttons, refresh and new-tab persistence with all document/quiz APIs blocked, browser isolation, storage errors, PDF extraction, citation validation, weak-topic practice, grading, chat, themes, and mobile overflow. Generated screenshots go into ignored `test-results/`.

These offline tests do not validate your live OpenAI quota, model access, Supabase credentials, email delivery, deployed RLS, or hosted runtime limits. After configuring providers, smoke-test sign-up/sign-in, upload, reload, quiz submission, practice, cited Q&A, and access isolation using a second account.

## Deploy to Vercel

1. Import the repository and set the Root Directory to `studylens` if your repository contains the parent Hackathon folder; otherwise use the repository root.
2. Select the Next.js preset, Node.js 22, `npm ci` for install and `npm run build` for build. Leave the output directory at its default.
3. For the standalone demo, leave all provider credentials unset. No database setup or signing secret is needed. To enable accounts and AI instead, apply the Supabase migration, configure all Supabase variables, and add `OPENAI_API_KEY` / `OPENAI_MODEL`.
4. Deploy or redeploy after these changes. For Supabase mode only, add the deployed origin to your Supabase Authentication URL settings.
5. Upload your own PDF and try the sample, refresh each workspace, then generate and submit a quiz. Demo data should remain accessible on the same browser and deployment domain. For AI mode, also run the live smoke tests above and confirm your plan supports the analysis route duration.

No persistent local filesystem, Python process, native canvas, or external PDF worker is needed. `unpdf` provides the serverless-compatible PDF.js bundle. Never expose the OpenAI or service-role key using a `NEXT_PUBLIC_` prefix.

## Project layout

```text
src/app/                    Landing, login, dashboard, document workspace
src/app/api/                Upload, document detail/retry, quiz, grading, practice, Q&A
src/components/             Shared UI, uploader, themes, citations
src/components/workspace/   Summary, notes, quiz, chat, source viewer
src/lib/                    Strict types, validation, extraction, chunking, AI, storage
supabase/migrations/         Schema, privileges, indexes and RLS
tests/                      Unit and browser/API tests
```

The app uses Next.js 16 async route parameters/cookies and `proxy.ts` for session refresh. Read the version-matched Next.js documentation noted in `AGENTS.md` before changing framework conventions.
