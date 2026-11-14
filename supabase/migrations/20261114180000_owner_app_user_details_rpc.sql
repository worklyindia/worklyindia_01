-- Owner-only RPC for the App User Details screen.
-- Avoids passing unsupported pagination/search arguments to the legacy RPC and
-- returns only profile fields needed by the owner monitoring page.
create or replace function public.get_owner_app_user_details()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  full_name text,
  phone text,
  location text,
  city text,
  state text,
  profile_image_url text,
  account_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not exists (
    select 1
      from public.admin_users au
     where au.user_id = auth.uid()
       and au.role = 'owner'
  ) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    p.full_name,
    p.phone,
    p.location,
    p.city,
    p.state,
    p.profile_image_url,
    p.account_status
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.get_owner_app_user_details() from public, anon;
grant execute on function public.get_owner_app_user_details() to authenticated;
