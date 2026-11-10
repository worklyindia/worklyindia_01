INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES
('employer_interview_scheduled', true, 'Interview update 📅', 'Candidate : {{name}}
Job : {{job_title}}
Status : {{status}}
Interview date : {{interview_date}}
Interview time : {{interview_time}}
Mode : {{mode}}', 'View Interviews', '/employer-portal'),
('account_banned_employer', true, '🚫 Your employer account has been suspended', 'Hi {{name}},

The Workly India employer account for {{company}} ({{email}}) has been suspended by our team.

Reason: {{reason}}
Suspended on: {{date}} at {{time}}

While the account is suspended you cannot sign in, post jobs or view applications.

If you believe this is a mistake, please contact our support team and we will review your company account.

Regards,
Team Workly India', 'Contact Support', '/contact'),
('account_banned_job_seeker', true, '🚫 Your account has been suspended', 'Hi {{name}},

Your Workly India job seeker account ({{email}}) has been suspended by our team.

Reason: {{reason}}
Suspended on: {{date}} at {{time}}

While the account is suspended you cannot sign in, apply to jobs or receive interview invitations.

If you believe this is a mistake, please contact our support team and we will review your account.

Regards,
Team Workly India', 'Contact Support', '/contact'),
('account_unbanned_employer', true, '✅ Your employer account is active again', 'Hi {{name}},

The suspension on the Workly India employer account for {{company}} ({{email}}) has been removed.

Restored on: {{date}} at {{time}}

You can sign in again, post jobs and manage applications as usual. Please follow our employer guidelines so your account stays in good standing.

Regards,
Team Workly India', 'Go to Dashboard', '/employer/dashboard'),
('account_unbanned_job_seeker', true, '✅ Your account is active again', 'Hi {{name}},

Good news — the suspension on your Workly India job seeker account ({{email}}) has been removed.

Restored on: {{date}} at {{time}}

You can sign in again, apply to jobs and receive interview updates as usual. Please follow our community guidelines so your account stays in good standing.

Regards,
Team Workly India', 'Browse Jobs', '/jobs'),
('bot_code_used_employer', true, '⚠️ Code Already Used', 'This employer account is already connected to a different Telegram account.

💡 First disconnect Telegram from Employer Settings → Telegram Integration, then generate a new connect code and send it here.
Date : {{date}}
Time : {{time}}', 'Employer Settings', '/employer-settings'),
('job_apply_banned', true, '⚠️ Job applications paused on your account', 'Hi {{name}},

Your Workly India account ({{email}}) can no longer apply to jobs. Our team has placed a job application restriction on the account.

Reason: {{reason}}
Applied on: {{date}} at {{time}}

You can still sign in and view your profile, but new applications are blocked until the restriction is removed.

If you think this is a mistake, please contact our support team.

Regards,
Team Workly India', 'Contact Support', '/contact'),
('job_apply_unbanned', true, '✅ You can apply to jobs again', 'Hi {{name}},

The job application restriction on your Workly India account ({{email}}) has been removed.

Restored on: {{date}} at {{time}}

You can start applying to jobs right away. Keep your profile updated so employers notice you faster.

Regards,
Team Workly India', 'Apply Now', '/jobs'),
('job_posting_banned', true, '⚠️ Job posting paused for your company', 'Hi {{name}},

New job posting has been paused for {{company}} on Workly India.

Reason: {{reason}}
Applied on: {{date}} at {{time}}

Your account still works and your existing jobs stay visible, but you cannot publish new jobs until this restriction is removed.

If you think this is a mistake, please contact our support team.

Regards,
Team Workly India', 'Contact Support', '/contact'),
('job_posting_unbanned', true, '✅ You can post jobs again', 'Hi {{name}},

Job posting has been enabled again for {{company}} on Workly India.

Restored on: {{date}} at {{time}}

You can publish new openings right away and start receiving applications from candidates.

Regards,
Team Workly India', 'Post a Job', '/employer/post-job')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url)
SELECT event_type, true, title, body, button_text, button_url
FROM public.push_lifecycle_templates
WHERE event_type IN ('employer_interview_scheduled','account_banned_employer','account_banned_job_seeker','account_unbanned_employer','account_unbanned_job_seeker','bot_code_used_employer','job_apply_banned','job_apply_unbanned','job_posting_banned','job_posting_unbanned')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url)
SELECT event_type, true, title, body, button_text, button_url
FROM public.push_lifecycle_templates
WHERE event_type IN ('employer_interview_scheduled','account_banned_employer','account_banned_job_seeker','account_unbanned_employer','account_unbanned_job_seeker','bot_code_used_employer','job_apply_banned','job_apply_unbanned','job_posting_banned','job_posting_unbanned')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.calculate_and_award_competition_prizes(p_cycle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_winner RECORD;
  v_prize_config jsonb;
  v_current_balance numeric;
  v_result jsonb := '[]'::jsonb;
  v_winners_awarded integer := 0;
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';
  v_url text := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api';
  v_title text;
  v_message text;
BEGIN
  SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';

  SELECT jsonb_object_agg(rank::text, prize_amount)
  INTO v_prize_config
  FROM referral_competition_prizes
  WHERE is_active = true;

  IF v_prize_config IS NULL THEN
    RAISE EXCEPTION 'No active prize configuration found';
  END IF;

  FOR v_winner IN
    WITH ranked_entries AS (
      SELECT 
        h.user_id,
        h.final_rank as rank,
        h.active_referrals_count,
        h.company_name,
        COUNT(*) OVER (PARTITION BY h.final_rank) as tied_users_count,
        (v_prize_config->(h.final_rank::text))::numeric as base_prize
      FROM referral_leaderboard_history h
      WHERE h.cycle_id = p_cycle_id
        AND h.final_rank <= 3
        AND h.winners_announced = false
      ORDER BY h.final_rank, h.active_referrals_count DESC
    )
    SELECT 
      user_id,
      rank,
      active_referrals_count,
      company_name,
      tied_users_count,
      base_prize,
      ROUND((base_prize / tied_users_count), 2) as split_prize
    FROM ranked_entries
  LOOP
    SELECT COALESCE(balance_amount, 0)
    INTO v_current_balance
    FROM referral_wallets
    WHERE user_id = v_winner.user_id;

    IF NOT FOUND THEN
      INSERT INTO referral_wallets (user_id, balance_amount, total_earned)
      VALUES (v_winner.user_id, 0, 0);
      v_current_balance := 0;
    END IF;

    INSERT INTO referral_wallet_adjustments (
      user_id,
      adjustment_type,
      amount,
      reason,
      balance_before,
      balance_after
    ) VALUES (
      v_winner.user_id,
      'add',
      v_winner.split_prize,
      format('🏆 Competition Prize - Rank #%s (%s active referrals)%s',
        v_winner.rank,
        v_winner.active_referrals_count,
        CASE 
          WHEN v_winner.tied_users_count > 1 
          THEN format(' - Tied with %s other%s', 
            v_winner.tied_users_count - 1,
            CASE WHEN v_winner.tied_users_count - 1 > 1 THEN 's' ELSE '' END
          )
          ELSE '' 
        END
      ),
      v_current_balance,
      v_current_balance + v_winner.split_prize
    );

    UPDATE referral_wallets
    SET 
      balance_amount = balance_amount + v_winner.split_prize,
      total_earned = total_earned + v_winner.split_prize,
      updated_at = now()
    WHERE user_id = v_winner.user_id;

    UPDATE referral_leaderboard_history
    SET 
      reward_amount = v_winner.split_prize,
      winners_announced = true
    WHERE cycle_id = p_cycle_id
      AND user_id = v_winner.user_id;

    v_winners_awarded := v_winners_awarded + 1;

    -- Notify the winner (bell + push; push fans out to email and Telegram)
    v_title := 'You won a prize 🏆';
    v_message := format('Rank #%s in the monthly referral competition. ₹%s has been added to your referral wallet.',
                        v_winner.rank, v_winner.split_prize);

    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type, action_url, metadata)
      VALUES (v_winner.user_id, v_title, v_message, 'referral_competition_win', '/referral',
              jsonb_build_object('cycle_id', p_cycle_id, 'rank', v_winner.rank,
                                 'prize_amount', v_winner.split_prize));

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
          'user_id', v_winner.user_id,
          'title', v_title,
          'message', v_message,
          'action_url', '/referral',
          'button_text', 'View Referrals',
          'skip_rephrase', true,
          'event_type', 'referral_competition_win',
          'variables', jsonb_build_object(
            'rank', v_winner.rank::text,
            'prize', '₹' || v_winner.split_prize::text,
            'amount', '₹' || v_winner.split_prize::text
          ),
          'data', jsonb_build_object('type', 'referral_competition_win',
                                     'cycle_id', p_cycle_id,
                                     'rank', v_winner.rank)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'competition prize notification failed for %: %', v_winner.user_id, SQLERRM;
    END;

    v_result := v_result || jsonb_build_object(
      'user_id', v_winner.user_id,
      'company_name', v_winner.company_name,
      'rank', v_winner.rank,
      'active_referrals', v_winner.active_referrals_count,
      'prize_amount', v_winner.split_prize,
      'tied_users', v_winner.tied_users_count,
      'status', 'awarded'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'cycle_id', p_cycle_id,
    'total_winners', v_winners_awarded,
    'winners', v_result,
    'timestamp', now()
  );
END;
$function$;