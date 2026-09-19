-- StudyLens schema
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

create extension if not exists "pgcrypto";

-- Uploaded PDFs ------------------------------------------------------------
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  page_count  integer not null default 0,
  status      text not null default 'processing'
              check (status in ('processing', 'ready', 'error')),
  error       text,
  created_at  timestamptz not null default now()
);

-- Extracted text chunks, preserving page ranges ----------------------------
create table public.document_sections (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  page_start  integer not null,
  page_end    integer not null,
  heading     text not null default '',
  content     text not null,
  order_index integer not null
);
create index document_sections_document_id_idx on public.document_sections (document_id);

-- Generated study material (one row per document, JSON blob) ---------------
create table public.summaries (
  document_id uuid primary key references public.documents (id) on delete cascade,
  material    jsonb not null,
  created_at  timestamptz not null default now()
);

-- Quizzes ------------------------------------------------------------------
create table public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  label          text not null default 'Quiz',
  difficulty     text not null check (difficulty in ('easy', 'medium', 'hard')),
  type           text not null
                 check (type in ('multiple_choice', 'true_false', 'short_answer', 'mixed')),
  question_count integer not null,
  parent_quiz_id uuid references public.quizzes (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index quizzes_document_id_idx on public.quizzes (document_id);

create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes (id) on delete cascade,
  order_index    integer not null,
  type           text not null
                 check (type in ('multiple_choice', 'true_false', 'short_answer')),
  question       text not null,
  options        jsonb,
  correct_answer text not null,
  explanation    text not null default '',
  difficulty     text not null check (difficulty in ('easy', 'medium', 'hard')),
  topic          text not null default '',
  pages          integer[] not null default '{}'
);
create index questions_quiz_id_idx on public.questions (quiz_id);

-- Attempts + answers + weak topics ------------------------------------------
create table public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  score      integer not null check (score >= 0 and score <= total),
  total      integer not null check (total between 1 and 15),
  result     jsonb not null,
  created_at timestamptz not null default now()
);

create table public.answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  user_answer text not null default '',
  is_correct  boolean not null
);
create index answers_attempt_id_idx on public.answers (attempt_id);

create table public.weak_topics (
  id         uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  topic      text not null,
  pages      integer[] not null default '{}'
);
create index weak_topics_attempt_id_idx on public.weak_topics (attempt_id);
create index documents_user_id_idx on public.documents (user_id);
create index quiz_attempts_quiz_user_idx on public.quiz_attempts (quiz_id, user_id, created_at desc);

revoke all on public.documents, public.document_sections, public.summaries, public.quizzes, public.questions, public.quiz_attempts, public.answers, public.weak_topics from anon, authenticated;
grant select on public.documents, public.document_sections, public.summaries, public.quizzes, public.quiz_attempts, public.answers, public.weak_topics to authenticated;
grant all on public.documents, public.document_sections, public.summaries, public.quizzes, public.questions, public.quiz_attempts, public.answers, public.weak_topics to service_role;

-- Row Level Security ---------------------------------------------------------
alter table public.documents         enable row level security;
alter table public.document_sections enable row level security;
alter table public.summaries         enable row level security;
alter table public.quizzes           enable row level security;
alter table public.questions         enable row level security;
alter table public.quiz_attempts     enable row level security;
alter table public.answers           enable row level security;
alter table public.weak_topics       enable row level security;

-- Users own their documents; child tables delegate to the parent document.
create policy "own documents" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sections of own documents" on public.document_sections
  for all using (
    exists (select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid())
  );

create policy "summaries of own documents" on public.summaries
  for all using (
    exists (select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid())
  );

create policy "own quizzes" on public.quizzes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "questions of own quizzes" on public.questions
  for all using (
    exists (select 1 from public.quizzes q
            where q.id = quiz_id and q.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.quizzes q
            where q.id = quiz_id and q.user_id = auth.uid())
  );

create policy "own attempts" on public.quiz_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "answers of own attempts" on public.answers
  for all using (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = auth.uid())
  );

create policy "weak topics of own attempts" on public.weak_topics
  for all using (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = auth.uid())
  );
