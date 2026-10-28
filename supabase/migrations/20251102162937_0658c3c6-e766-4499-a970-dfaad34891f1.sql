-- Fix competition prize payment function to use correct tables
-- This will make prizes appear in the History tab (referral_wallet_adjustments)

-- Drop the old buggy function
DROP FUNCTION IF EXISTS public.calculate_and_award_competition_prizes(uuid);

-- Create the fixed function that uses correct tables
CREATE OR REPLACE FUNCTION public.calculate_and_award_competition_prizes(p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner RECORD;
  v_prize_config jsonb;
  v_current_balance numeric;
  v_result jsonb := '[]'::jsonb;
  v_winners_awarded integer := 0;
BEGIN
  -- Get prize configuration from referral_competition_prizes table
  SELECT jsonb_object_agg(rank::text, prize_amount)
  INTO v_prize_config
  FROM referral_competition_prizes
  WHERE is_active = true
  ORDER BY rank;

  IF v_prize_config IS NULL THEN
    RAISE EXCEPTION 'No active prize configuration found';
  END IF;

  -- Loop through Top 3 winners with tie-handling
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
    -- Get current wallet balance
    SELECT COALESCE(balance_amount, 0)
    INTO v_current_balance
    FROM referral_wallets
    WHERE user_id = v_winner.user_id;

    -- If wallet doesn't exist, create it
    IF NOT FOUND THEN
      INSERT INTO referral_wallets (user_id, balance_amount, total_earned)
      VALUES (v_winner.user_id, 0, 0);
      v_current_balance := 0;
    END IF;

    -- Insert into referral_wallet_adjustments (this shows in History tab)
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

    -- Update referral_wallets balance
    UPDATE referral_wallets
    SET 
      balance_amount = balance_amount + v_winner.split_prize,
      total_earned = total_earned + v_winner.split_prize,
      updated_at = now()
    WHERE user_id = v_winner.user_id;

    -- Mark as awarded in history
    UPDATE referral_leaderboard_history
    SET 
      reward_amount = v_winner.split_prize,
      winners_announced = true
    WHERE cycle_id = p_cycle_id
      AND user_id = v_winner.user_id;

    v_winners_awarded := v_winners_awarded + 1;

    -- Build result JSON
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

  -- Return summary
  RETURN jsonb_build_object(
    'cycle_id', p_cycle_id,
    'total_winners', v_winners_awarded,
    'winners', v_result,
    'timestamp', now()
  );
END;
$$;