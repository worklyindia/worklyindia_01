-- =====================================================
-- CRITICAL FIXES: Prize Payments, History, Leaderboard
-- =====================================================

-- FIX #1: Update calculate_and_award_competition_prizes function
-- Issue: Wrong column name (referrals_count should be active_referrals_count)
CREATE OR REPLACE FUNCTION public.calculate_and_award_competition_prizes(p_cycle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner RECORD;
  v_prize_amount NUMERIC;
  v_results JSONB := '[]'::jsonb;
  v_rank INTEGER;
BEGIN
  RAISE NOTICE '🏆 Starting prize calculation for cycle: %', p_cycle_id;
  
  -- Get top 3 winners from leaderboard for this cycle
  FOR v_winner IN
    SELECT 
      user_id,
      active_referrals_count,
      ROW_NUMBER() OVER (ORDER BY active_referrals_count DESC, last_referral_at ASC) as rank
    FROM public.referral_leaderboard_entries
    WHERE cycle_id = p_cycle_id
      AND active_referrals_count > 0
    ORDER BY active_referrals_count DESC, last_referral_at ASC
    LIMIT 3
  LOOP
    v_rank := v_winner.rank::INTEGER;
    
    RAISE NOTICE '💰 Processing rank % for user % with % referrals', v_rank, v_winner.user_id, v_winner.active_referrals_count;
    
    -- Get prize amount for this rank
    SELECT prize_amount INTO v_prize_amount
    FROM public.referral_competition_prizes
    WHERE rank = v_rank AND is_active = true
    LIMIT 1;
    
    -- Skip if no prize defined for this rank
    IF v_prize_amount IS NULL THEN
      RAISE NOTICE '⚠️ No prize configured for rank %', v_rank;
      CONTINUE;
    END IF;
    
    -- Check if prize already awarded
    IF EXISTS (
      SELECT 1 FROM public.competition_prize_payments
      WHERE cycle_id = p_cycle_id AND user_id = v_winner.user_id
    ) THEN
      RAISE NOTICE '⚠️ Prize already awarded for user %', v_winner.user_id;
      CONTINUE;
    END IF;
    
    BEGIN
      -- Create prize payment record
      INSERT INTO public.competition_prize_payments (
        cycle_id,
        user_id,
        rank,
        prize_amount,
        status,
        created_at
      ) VALUES (
        p_cycle_id,
        v_winner.user_id,
        v_rank,
        v_prize_amount,
        'pending',
        now()
      );
      
      -- Credit prize to referral wallet
      INSERT INTO public.referral_wallets (user_id, balance, total_earned, created_at, updated_at)
      VALUES (v_winner.user_id, v_prize_amount, v_prize_amount, now(), now())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        balance = referral_wallets.balance + v_prize_amount,
        total_earned = referral_wallets.total_earned + v_prize_amount,
        updated_at = now();
      
      -- Create commission record for tracking
      INSERT INTO public.referral_commissions (
        referrer_id,
        referred_user_id,
        transaction_id,
        commission_amount,
        status,
        source_type,
        metadata,
        created_at
      ) VALUES (
        v_winner.user_id,
        v_winner.user_id,
        NULL,
        v_prize_amount,
        'completed',
        'competition_prize',
        jsonb_build_object(
          'cycle_id', p_cycle_id,
          'rank', v_rank,
          'referrals_count', v_winner.active_referrals_count
        ),
        now()
      );
      
      -- Update prize payment status
      UPDATE public.competition_prize_payments
      SET 
        status = 'credited',
        credited_at = now()
      WHERE cycle_id = p_cycle_id AND user_id = v_winner.user_id;
      
      RAISE NOTICE '✅ Prize awarded: Rank % - ₹% to user %', v_rank, v_prize_amount, v_winner.user_id;
      
      -- Add to results
      v_results := v_results || jsonb_build_object(
        'user_id', v_winner.user_id,
        'rank', v_rank,
        'prize_amount', v_prize_amount,
        'referrals_count', v_winner.active_referrals_count,
        'status', 'success'
      );
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ Error awarding prize: %', SQLERRM;
      -- Log error
      UPDATE public.competition_prize_payments
      SET 
        status = 'failed',
        error_message = SQLERRM
      WHERE cycle_id = p_cycle_id AND user_id = v_winner.user_id;
      
      v_results := v_results || jsonb_build_object(
        'user_id', v_winner.user_id,
        'rank', v_rank,
        'status', 'failed',
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RAISE NOTICE '🎯 Prize calculation complete. Results: %', v_results;
  
  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', p_cycle_id,
    'prizes_awarded', v_results
  );
END;
$$;

-- FIX #2: Update finalize_monthly_cycle to create history entries
CREATE OR REPLACE FUNCTION public.finalize_monthly_cycle(p_cycle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner RECORD;
  v_reward_amount NUMERIC;
  v_cycle_info RECORD;
BEGIN
  RAISE NOTICE '🏁 Finalizing cycle: %', p_cycle_id;
  
  -- Get cycle info
  SELECT cycle_start, cycle_end INTO v_cycle_info
  FROM public.referral_leaderboard_cycles
  WHERE id = p_cycle_id;
  
  IF v_cycle_info IS NULL THEN
    RAISE EXCEPTION 'Cycle not found: %', p_cycle_id;
  END IF;
  
  -- Update cycle status to processing
  UPDATE public.referral_leaderboard_cycles
  SET status = 'processing', updated_at = now()
  WHERE id = p_cycle_id;
  
  RAISE NOTICE '📊 Creating history entries for all participants...';
  
  -- Create history entries for ALL participants in this cycle
  INSERT INTO public.referral_leaderboard_history (
    cycle_id,
    cycle_start,
    cycle_end,
    user_id,
    company_name,
    final_rank,
    active_referrals_count,
    reward_amount,
    created_at
  )
  SELECT 
    e.cycle_id,
    v_cycle_info.cycle_start,
    v_cycle_info.cycle_end,
    e.user_id,
    COALESCE(c.company_name, 'Company') as company_name,
    e.rank as final_rank,
    e.active_referrals_count,
    CASE 
      WHEN e.rank = 1 THEN (SELECT prize_amount FROM public.referral_competition_prizes WHERE rank = 1 AND is_active = true LIMIT 1)
      WHEN e.rank = 2 THEN (SELECT prize_amount FROM public.referral_competition_prizes WHERE rank = 2 AND is_active = true LIMIT 1)
      WHEN e.rank = 3 THEN (SELECT prize_amount FROM public.referral_competition_prizes WHERE rank = 3 AND is_active = true LIMIT 1)
      ELSE 0
    END as reward_amount,
    now()
  FROM public.referral_leaderboard_entries e
  LEFT JOIN public.companies c ON c.user_id = e.user_id
  WHERE e.cycle_id = p_cycle_id
    AND e.active_referrals_count > 0
  ON CONFLICT (cycle_id, user_id) DO NOTHING;
  
  RAISE NOTICE '✅ History entries created';
  
  -- Process Top 3 winners for wallet credits
  FOR v_winner IN
    SELECT 
      e.user_id,
      e.rank,
      e.active_referrals_count,
      COALESCE(c.company_name, 'Company') AS company_name
    FROM public.referral_leaderboard_entries e
    LEFT JOIN public.companies c ON c.user_id = e.user_id
    WHERE e.cycle_id = p_cycle_id
      AND e.rank IS NOT NULL
      AND e.rank <= 3
    ORDER BY e.rank ASC
  LOOP
    -- Fetch dynamic reward amount from prizes table
    SELECT prize_amount INTO v_reward_amount
    FROM public.referral_competition_prizes
    WHERE rank = v_winner.rank AND is_active = true
    LIMIT 1;
    
    -- Fallback to default if not configured
    IF v_reward_amount IS NULL THEN
      v_reward_amount := CASE v_winner.rank
        WHEN 1 THEN 200
        WHEN 2 THEN 150
        WHEN 3 THEN 100
        ELSE 0
      END;
    END IF;
    
    RAISE NOTICE '💰 Processing winner - Rank %: User % with % referrals (Prize: ₹%)', 
      v_winner.rank, v_winner.user_id, v_winner.active_referrals_count, v_reward_amount;
    
    -- Send notification
    INSERT INTO public.employer_notifications (
      user_id,
      title,
      message,
      type,
      metadata
    ) VALUES (
      v_winner.user_id,
      '🏆 Competition Winner!',
      'Congratulations! You ranked #' || v_winner.rank || ' in the monthly referral competition and won ₹' || v_reward_amount || '!',
      'success',
      jsonb_build_object(
        'cycle_id', p_cycle_id,
        'rank', v_winner.rank,
        'prize_amount', v_reward_amount
      )
    );
  END LOOP;
  
  -- Update cycle status to completed
  UPDATE public.referral_leaderboard_cycles
  SET status = 'completed', winners_announced = true, updated_at = now()
  WHERE id = p_cycle_id;
  
  RAISE NOTICE '🎉 Cycle finalization complete!';
END;
$$;

-- FIX #3: Ensure refresh_current_leaderboard has proper error handling
CREATE OR REPLACE FUNCTION public.refresh_current_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM populate_current_leaderboard();
  RAISE NOTICE '✅ Leaderboard refreshed successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Leaderboard refresh failed: %', SQLERRM;
  RAISE;
END;
$$;

-- FIX #4: Add get_current_leaderboard RPC function with proper column names
CREATE OR REPLACE FUNCTION public.get_current_leaderboard(p_limit INTEGER DEFAULT 999999)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  company_name TEXT,
  logo_url TEXT,
  active_referrals_count INTEGER,
  last_referral_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.rank::INTEGER,
    e.user_id,
    COALESCE(c.company_name, 'Company') as company_name,
    c.logo_url,
    e.active_referrals_count::INTEGER,
    e.last_referral_at
  FROM referral_leaderboard_entries e
  INNER JOIN referral_leaderboard_cycles cy ON cy.id = e.cycle_id
  LEFT JOIN companies c ON c.user_id = e.user_id
  WHERE cy.status = 'active'
    AND e.active_referrals_count > 0
    AND e.rank IS NOT NULL
  ORDER BY e.rank ASC
  LIMIT p_limit;
END;
$$;

-- FIX #5: Manually refresh the current leaderboard to populate all entries
DO $$
BEGIN
  RAISE NOTICE '🔄 Refreshing current leaderboard...';
  PERFORM refresh_current_leaderboard();
  RAISE NOTICE '✅ Leaderboard refresh complete';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ Manual refresh failed: %', SQLERRM;
END;
$$;