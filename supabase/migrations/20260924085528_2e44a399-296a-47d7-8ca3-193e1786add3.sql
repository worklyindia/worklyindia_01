create or replace function public.owner_notification_delivery_history(_date date)
returns table(user_id uuid, user_type text, full_name text, email text, phone text, push_sent int, push_failed int, telegram_sent int, telegram_failed int, email_sent int, email_failed int)
language plpgsql stable security definer set search_path = public as $$
declare s timestamptz := (_date::timestamp at time zone 'Asia/Kolkata'); e timestamptz := s + interval '1 day';
begin
  if not (public.has_role(auth.uid(),'owner'::app_role) or public.has_role(auth.uid(),'admin'::app_role)) then
    raise exception 'not allowed';
  end if;
  return query
  with ev as (
    select p.user_id uid, 'push' ch, (p.status='sent') ok from push_notification_logs p where coalesce(p.sent_at,p.created_at) >= s and coalesce(p.sent_at,p.created_at) < e and p.user_id is not null
    union all
    select coalesce(pr.user_id, c.user_id), 'tg', (q.status='sent') from telegram_message_queue q
      left join profiles pr on pr.telegram_chat_id = q.chat_id
      left join companies c on pr.user_id is null and c.telegram_chat_id = q.chat_id
      where q.created_at >= s and q.created_at < e and q.status in ('sent','failed')
    union all
    select m.user_id, 'email', (m.event_type='delivered') from email_outbound_events m
      where m.event_at >= s and m.event_at < e and m.event_type in ('delivered','error','bounced','blocked') and m.user_id is not null
  ), agg as (
    select uid,
      count(*) filter (where ch='push' and ok)::int ps, count(*) filter (where ch='push' and not ok)::int pf,
      count(*) filter (where ch='tg' and ok)::int ts, count(*) filter (where ch='tg' and not ok)::int tf,
      count(*) filter (where ch='email' and ok)::int es, count(*) filter (where ch='email' and not ok)::int ef
    from ev where uid is not null group by uid
  )
  select a.uid,
    case when exists(select 1 from user_roles r where r.user_id=a.uid and r.role='employer') or exists(select 1 from companies c2 where c2.user_id=a.uid) then 'employer' else 'jobseeker' end,
    coalesce(pr.full_name, (select c3.company_name from companies c3 where c3.user_id=a.uid limit 1)),
    coalesce(pr.email, (select c3.email from companies c3 where c3.user_id=a.uid limit 1)),
    coalesce(pr.phone, (select c3.phone from companies c3 where c3.user_id=a.uid limit 1)),
    a.ps,a.pf,a.ts,a.tf,a.es,a.ef
  from agg a left join profiles pr on pr.user_id=a.uid
  order by (a.ps+a.ts+a.es) desc;
end $$;
grant execute on function public.owner_notification_delivery_history(date) to authenticated;