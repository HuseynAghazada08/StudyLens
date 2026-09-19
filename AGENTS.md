<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## StudyLens

- Node.js 22 LTS recommended. Install with `npm ci`; start with `npm run dev`.
- Verify with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Browser/API regression tests: run the app, install Chromium with `npx playwright install chromium`, then `npm run test:e2e`. `TEST_BASE_URL` overrides `http://localhost:3000`.
- Offline tests expect no OpenAI or Supabase credentials. Do not run them against a real user's database.
- Set `TEST_SERVER_MODE=production` when running browser tests against `next start`; preview-origin tests then expect rejection. Development accepts HTTP(S) origins on exactly localhost or 127.0.0.1 with arbitrary ports; production requires the same scheme, host and port.
- Secrets stay in server modules. Browser code imports `env-client.ts`, never secret-bearing modules.
- Supabase persistence is independent of OpenAI availability. The server service-role client requires route-level ownership checks; questions and mutations are not accessible through the public Supabase client.
- Without Supabase, the upload API returns a stateless document snapshot. `browser-store.ts` saves documents, quizzes and latest results in IndexedDB before navigation. All later demo study operations use browser storage; never restore a server-memory fallback or require a demo-session signing secret.
- Demo data is browser-profile/origin scoped, including Vercel deployments. Regression tests clear cookies and block document/quiz APIs before refreshing. Supabase mode continues using authenticated server storage.
- Upload limit: 4 MB, 80 pages, 160,000 extracted characters. Citations open extracted source text, not a rendered PDF image.
