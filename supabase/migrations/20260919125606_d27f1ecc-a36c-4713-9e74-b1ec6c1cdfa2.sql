-- Log of automatically removed unused files
create table if not exists public.storage_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_name text not null,
  size_bytes bigint,
  reason text not null default 'orphan',
  deleted_at timestamptz not null default now()
);

grant select on public.storage_cleanup_log to authenticated;
grant all on public.storage_cleanup_log to service_role;

alter table public.storage_cleanup_log enable row level security;

drop policy if exists "Admins can view storage cleanup log" on public.storage_cleanup_log;
create policy "Admins can view storage cleanup log"
on public.storage_cleanup_log
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'owner'::app_role));

-- Collect every file-like reference stored anywhere in the public schema
create or replace function public.storage_referenced_keys()
returns table(key text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.data_type in ('text', 'character varying', 'json', 'jsonb')
      and c.table_name <> 'storage_cleanup_log'
  loop
    return query execute format(
      'select distinct m[1] from public.%I, lateral regexp_matches(%I::text, %L, %L) as m where %I is not null',
      r.table_name,
      r.column_name,
      '([A-Za-z0-9._/-]+\.(?:jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|mp3|mp4|wav|webm|pdf|docx|doc))',
      'gi',
      r.column_name
    );
  end loop;
end;
$$;

revoke all on function public.storage_referenced_keys() from public;
grant execute on function public.storage_referenced_keys() to service_role;

-- Files that exist in storage but are no longer referenced by the website
create or replace function public.storage_orphan_objects(
  grace_hours integer default 24,
  max_rows integer default 500
)
returns table(bucket_id text, object_name text, size_bytes bigint)
language sql
stable
security definer
set search_path = public, storage
as $$
  with refs as (
    select distinct lower(regexp_replace(key, '^.*/', '')) as base
    from public.storage_referenced_keys()
  ),
  managed(b) as (
    select unnest(array[
      'profile-photos',
      'job-images',
      'brand-assets',
      'public-assets',
      'company-logos',
      'ai-engagement-images',
      'notification-cards',
      'temp-downloads'
    ])
  )
  select o.bucket_id,
         o.name,
         (o.metadata->>'size')::bigint
  from storage.objects o
  join managed m on m.b = o.bucket_id
  where o.created_at < now() - make_interval(hours => greatest(grace_hours, 1))
    and lower(regexp_replace(o.name, '^.*/', '')) not in (select base from refs)
  order by (o.metadata->>'size')::bigint desc nulls last
  limit greatest(max_rows, 1);
$$;

revoke all on function public.storage_orphan_objects(integer, integer) from public;
grant execute on function public.storage_orphan_objects(integer, integer) to service_role;