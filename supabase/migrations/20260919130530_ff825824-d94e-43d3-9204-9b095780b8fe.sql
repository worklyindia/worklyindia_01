-- Files that must never be auto-removed (referenced from code, PWA manifest,
-- sitemaps or e-mail templates rather than from a database row).
create table if not exists public.storage_protected_paths (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  path_prefix text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (bucket_id, path_prefix)
);

grant select on public.storage_protected_paths to authenticated;
grant all on public.storage_protected_paths to service_role;

alter table public.storage_protected_paths enable row level security;

drop policy if exists "Admins manage protected storage paths" on public.storage_protected_paths;
create policy "Admins manage protected storage paths"
on public.storage_protected_paths
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'owner'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'owner'::app_role));

insert into public.storage_protected_paths (bucket_id, path_prefix, note) values
  ('brand-assets', 'site/', 'Logos, PWA icons/screenshots, template previews used directly in code'),
  ('public-assets', 'brand-assets/', 'Header logo used in index.html'),
  ('public-assets', 'notifications/', 'E-mail template mascot images'),
  ('public-assets', 'hero-banners/', 'Home page banners'),
  ('job-images', '1769cddb-7244-4b4b-a86f-e0ca3bc028db/ai-1786207805172.png', 'Listed in public image sitemap')
on conflict (bucket_id, path_prefix) do nothing;

-- Unused files, excluding anything protected above
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
    and not exists (
      select 1 from public.storage_protected_paths p
      where p.bucket_id = o.bucket_id
        and o.name like p.path_prefix || '%'
    )
  order by (o.metadata->>'size')::bigint desc nulls last
  limit greatest(max_rows, 1);
$$;

revoke all on function public.storage_orphan_objects(integer, integer) from public;
grant execute on function public.storage_orphan_objects(integer, integer) to service_role;