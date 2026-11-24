create table if not exists public.ai_chat_conversation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null default 'default' check (audience in ('default','developer','employer')),
  message_id text not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  model text,
  status text not null default 'completed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, audience, message_id)
);
create index if not exists ai_chat_conversation_logs_created_at_idx on public.ai_chat_conversation_logs (created_at desc);
create index if not exists ai_chat_conversation_logs_user_created_idx on public.ai_chat_conversation_logs (user_id, created_at desc);
alter table public.ai_chat_conversation_logs enable row level security;
revoke all on public.ai_chat_conversation_logs from anon, public;
grant select, insert on public.ai_chat_conversation_logs to authenticated;
drop policy if exists "Users can insert their own AI chat messages" on public.ai_chat_conversation_logs;
create policy "Users can insert their own AI chat messages" on public.ai_chat_conversation_logs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Owners can read AI chat conversation logs" on public.ai_chat_conversation_logs;
create policy "Owners can read AI chat conversation logs" on public.ai_chat_conversation_logs for select to authenticated using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'owner'));