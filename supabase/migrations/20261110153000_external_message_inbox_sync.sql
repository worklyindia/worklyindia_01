-- Separate, user-owned storage for messages mirrored from Android notifications.
-- Existing job-seeker/employer chat tables are intentionally untouched.

create table if not exists public.external_message_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('whatsapp','whatsapp_business','instagram','facebook','messenger')),
  external_conversation_key text not null,
  display_name text not null default 'Message',
  source_package text not null,
  last_message text,
  last_message_at timestamptz,
  open_target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_conversation_key)
);

create table if not exists public.external_message_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.external_message_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_message_key text not null,
  direction text not null check (direction in ('incoming','outgoing')),
  body text not null,
  delivery_status text not null default 'received'
    check (delivery_status in ('received','pending','submitted_unconfirmed','delivered','failed')),
  source_notification_id text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, external_message_key)
);

create index if not exists external_message_conversations_user_updated_idx
  on public.external_message_conversations(user_id, updated_at desc);
create index if not exists external_message_messages_conversation_created_idx
  on public.external_message_messages(conversation_id, created_at asc);
create index if not exists external_message_messages_user_created_idx
  on public.external_message_messages(user_id, created_at desc);

alter table public.external_message_conversations enable row level security;
alter table public.external_message_messages enable row level security;

drop policy if exists "Users read own external conversations" on public.external_message_conversations;
create policy "Users read own external conversations"
  on public.external_message_conversations for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Users insert own external conversations" on public.external_message_conversations;
create policy "Users insert own external conversations"
  on public.external_message_conversations for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Users update own external conversations" on public.external_message_conversations;
create policy "Users update own external conversations"
  on public.external_message_conversations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users delete own external conversations" on public.external_message_conversations;
create policy "Users delete own external conversations"
  on public.external_message_conversations for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users read own external messages" on public.external_message_messages;
create policy "Users read own external messages"
  on public.external_message_messages for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Users insert own external messages" on public.external_message_messages;
create policy "Users insert own external messages"
  on public.external_message_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.external_message_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
drop policy if exists "Users update own external messages" on public.external_message_messages;
create policy "Users update own external messages"
  on public.external_message_messages for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users delete own external messages" on public.external_message_messages;
create policy "Users delete own external messages"
  on public.external_message_messages for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.external_message_conversations to authenticated;
grant select, insert, update, delete on public.external_message_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'external_message_conversations') then
      alter publication supabase_realtime add table public.external_message_conversations;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'external_message_messages') then
      alter publication supabase_realtime add table public.external_message_messages;
    end if;
  end if;
end $$;
