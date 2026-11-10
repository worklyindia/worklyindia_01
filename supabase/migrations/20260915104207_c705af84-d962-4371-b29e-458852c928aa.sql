
CREATE OR REPLACE FUNCTION public.run_expiry_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';
  v_url text := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api';
  r record;
  v_sent int := 0;
BEGIN
  SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';

  FOR r IN
    WITH items AS (
      -- Job posts
      SELECT 'job'::text AS entity_type, j.id::text AS entity_id, c.user_id,
             j.expires_at AS expires_at, 'job_expiry'::text AS notif_type,
             '/employer-portal'::text AS action_url,
             COALESCE(j.title, 'your job') AS label
      FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.expires_at IS NOT NULL AND c.user_id IS NOT NULL

      UNION ALL
      -- Job boosts
      SELECT 'job_boost', b.id::text, b.user_id, b.boost_end_date, 'boost_expiry',
             '/employer-portal', COALESCE(j.title, 'your job')
      FROM public.job_boosts b
      LEFT JOIN public.jobs j ON j.id = b.job_id
      WHERE b.boost_end_date IS NOT NULL AND b.user_id IS NOT NULL

      UNION ALL
      -- Verified badge
      SELECT 'verification', c.id::text, c.user_id, c.verified_plan_end, 'verification_expiry',
             '/employer-portal', COALESCE(c.name, 'your company')
      FROM public.companies c
      WHERE c.verified_plan_end IS NOT NULL AND c.user_id IS NOT NULL

      UNION ALL
      -- Domains
      SELECT 'domain', d.id::text, d.user_id, d.expires_at, 'domain_expiry',
             '/domains', d.domain
      FROM public.domain_orders d
      WHERE d.status = 'completed' AND d.expires_at IS NOT NULL AND d.user_id IS NOT NULL

      UNION ALL
      -- AI chat plans
      SELECT 'ai_chat_plan', s.id::text, s.user_id, s.ends_at, 'ai_plan_expiry',
             '/ai-assistant/subscription', COALESCE(p.name, 'AI Chat')
      FROM public.ai_chat_subscriptions s
      LEFT JOIN public.ai_chat_plans p ON p.id = s.plan_id
      WHERE s.ends_at IS NOT NULL AND s.user_id IS NOT NULL
        AND (s.status IS NULL OR s.status IN ('active', 'expired'))
    )
    SELECT i.*,
           CASE WHEN i.expires_at <= now() THEN 'expired' ELSE 'pre_24h' END AS stage
    FROM items i
    WHERE i.expires_at BETWEEN now() - interval '48 hours' AND now() + interval '24 hours'
  LOOP
    DECLARE
      v_title text;
      v_message text;
      v_when text := to_char(r.expires_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM');
      v_claimed boolean := false;
    BEGIN
      -- Claim first: the unique index guarantees one alert per stage.
      BEGIN
        INSERT INTO public.expiry_notification_log (entity_type, entity_id, user_id, stage, expires_at)
        VALUES (r.entity_type, r.entity_id, r.user_id, r.stage, r.expires_at);
        v_claimed := true;
      EXCEPTION WHEN unique_violation THEN
        v_claimed := false;
      END;

      IF NOT v_claimed THEN
        CONTINUE;
      END IF;

      IF r.entity_type = 'job' THEN
        v_title := CASE WHEN r.stage = 'expired' THEN 'Job post expired ⌛' ELSE 'Job post expiring in 24 hours ⏰' END;
        v_message := CASE WHEN r.stage = 'expired'
          THEN 'Your job post "' || r.label || '" has expired and is no longer visible to candidates. Repost or extend it to keep receiving applications.'
          ELSE 'Your job post "' || r.label || '" expires on ' || v_when || '. Extend it now to stay visible to candidates.' END;
      ELSIF r.entity_type = 'job_boost' THEN
        v_title := CASE WHEN r.stage = 'expired' THEN 'Job boost ended 🚀' ELSE 'Job boost ending in 24 hours ⏰' END;
        v_message := CASE WHEN r.stage = 'expired'
          THEN 'The boost on "' || r.label || '" has ended, so it is back to normal ranking. Boost it again for more views.'
          ELSE 'The boost on "' || r.label || '" ends on ' || v_when || '. Renew it to keep the top spot.' END;
      ELSIF r.entity_type = 'verification' THEN
        v_title := CASE WHEN r.stage = 'expired' THEN 'Verified badge expired ❌' ELSE 'Verified badge expiring in 24 hours ⏰' END;
        v_message := CASE WHEN r.stage = 'expired'
          THEN 'The verified badge for ' || r.label || ' has expired. Renew it to keep candidates'' trust.'
          ELSE 'The verified badge for ' || r.label || ' expires on ' || v_when || '. Renew now to stay verified.' END;
      ELSIF r.entity_type = 'domain' THEN
        v_title := CASE WHEN r.stage = 'expired' THEN 'Domain expired 🌐' ELSE 'Domain expiring in 24 hours ⏰' END;
        v_message := CASE WHEN r.stage = 'expired'
          THEN r.label || ' has expired. Renew it immediately to avoid losing the name.'
          ELSE r.label || ' expires on ' || v_when || '. Renew it now to keep your website and email working.' END;
      ELSE
        v_title := CASE WHEN r.stage = 'expired' THEN 'AI plan expired 🤖' ELSE 'AI plan expiring in 24 hours ⏰' END;
        v_message := CASE WHEN r.stage = 'expired'
          THEN 'Your ' || r.label || ' plan has expired. Renew it to continue using AI chat, voice and image features.'
          ELSE 'Your ' || r.label || ' plan expires on ' || v_when || '. Renew now to avoid any interruption.' END;
      END IF;

      INSERT INTO public.notifications (user_id, title, message, type, action_url, metadata)
      VALUES (r.user_id, v_title, v_message, r.notif_type, r.action_url,
              jsonb_build_object('entity_type', r.entity_type, 'entity_id', r.entity_id,
                                 'stage', r.stage, 'expires_at', r.expires_at));

      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon,
          'apikey', v_anon,
          'x-points-trigger-secret', COALESCE(v_secret, '')
        ),
        body := jsonb_build_object(
          'action', 'send_push',
          'user_id', r.user_id,
          'title', v_title,
          'message', v_message,
          'action_url', r.action_url,
          'button_text', 'View details',
          'skip_rephrase', true,
          'event_type', r.notif_type,
          'data', jsonb_build_object('type', r.notif_type, 'entity_type', r.entity_type,
                                     'entity_id', r.entity_id, 'stage', r.stage)
        )
      );

      v_sent := v_sent + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('sent', v_sent, 'ran_at', now());
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_expiry_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_expiry_reminders() TO service_role;
