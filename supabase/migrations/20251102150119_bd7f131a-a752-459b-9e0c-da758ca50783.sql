-- Fix Competition Tie Handling & Equal Prize Distribution
-- This migration updates calculate_and_award_competition_prizes to properly handle tied users

DROP FUNCTION IF EXISTS calculate_and_award_competition_prizes(uuid);

CREATE OR REPLACE FUNCTION calculate_and_award_competition_prizes(p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prize_config jsonb;
  v_winner record;
  v_total_awarded numeric := 0;
  v_winners_count integer := 0;
  v_result jsonb := '[]'::jsonb;
BEGIN
  -- Get prize configuration for ranks 1, 2, 3
  SELECT jsonb_object_agg(rank::text, prize_amount)
  INTO v_prize_config
  FROM referral_competition_prizes
  WHERE is_active = true AND rank <= 3;

  RAISE LOG '🏆 Prize Config: %', v_prize_config;

  -- Award prizes to top 3 ranks (including ALL tied users)
  FOR v_winner IN
    WITH ranked_users AS (
      SELECT 
        rle.user_id,
        rle.active_referrals_count,
        ep.company_name,
        DENSE_RANK() OVER (ORDER BY rle.active_referrals_count DESC) as rank,
        COUNT(*) OVER (PARTITION BY DENSE_RANK() OVER (ORDER BY rle.active_referrals_count DESC)) as tied_users_count
      FROM referral_leaderboard_entries rle
      JOIN employer_profiles ep ON ep.user_id = rle.user_id
      WHERE rle.cycle_id = p_cycle_id
    )
    SELECT 
      user_id,
      company_name,
      rank,
      active_referrals_count,
      tied_users_count,
      (v_prize_config->(rank::text))::numeric as base_prize,
      ROUND(((v_prize_config->(rank::text))::numeric / tied_users_count), 2) as split_prize
    FROM ranked_users
    WHERE rank <= 3 AND (v_prize_config->(rank::text))::numeric > 0
    ORDER BY rank, company_name
  LOOP
    RAISE LOG '👤 Processing Winner: % (Rank #%, Tied: %, Base Prize: ₹%, Split Prize: ₹%)',
      v_winner.company_name, v_winner.rank, v_winner.tied_users_count, 
      v_winner.base_prize, v_winner.split_prize;

    -- Credit wallet with split prize amount
    INSERT INTO wallet_transactions (
      user_id,
      transaction_type,
      amount,
      status,
      description,
      metadata
    ) VALUES (
      v_winner.user_id,
      'credit',
      v_winner.split_prize,
      'completed',
      CASE 
        WHEN v_winner.tied_users_count > 1 THEN
          format('Competition Prize - Rank #%s (%s active referrals, tied with %s others)', 
            v_winner.rank, v_winner.active_referrals_count, v_winner.tied_users_count - 1)
        ELSE
          format('Competition Prize - Rank #%s (%s active referrals)', 
            v_winner.rank, v_winner.active_referrals_count)
      END,
      jsonb_build_object(
        'source', 'referral_competition',
        'cycle_id', p_cycle_id,
        'rank', v_winner.rank,
        'referrals', v_winner.active_referrals_count,
        'base_prize', v_winner.base_prize,
        'tied_users_count', v_winner.tied_users_count,
        'split_prize', v_winner.split_prize
      )
    );

    -- Update user's wallet balance
    UPDATE employer_profiles
    SET 
      wallet_balance = COALESCE(wallet_balance, 0) + v_winner.split_prize,
      updated_at = now()
    WHERE user_id = v_winner.user_id;

    -- Update history record with split prize amount
    UPDATE referral_leaderboard_history
    SET 
      reward_amount = v_winner.split_prize,
      metadata = jsonb_build_object(
        'base_prize', v_winner.base_prize,
        'tied_users_count', v_winner.tied_users_count,
        'split_prize', v_winner.split_prize
      ),
      updated_at = now()
    WHERE cycle_id = p_cycle_id AND user_id = v_winner.user_id;

    v_total_awarded := v_total_awarded + v_winner.split_prize;
    v_winners_count := v_winners_count + 1;

    -- Build result JSON
    v_result := v_result || jsonb_build_object(
      'user_id', v_winner.user_id,
      'company_name', v_winner.company_name,
      'rank', v_winner.rank,
      'referrals', v_winner.active_referrals_count,
      'tied_users_count', v_winner.tied_users_count,
      'base_prize', v_winner.base_prize,
      'awarded_amount', v_winner.split_prize
    );

    RAISE LOG '✅ Awarded ₹% to % (Rank #%)', v_winner.split_prize, v_winner.company_name, v_winner.rank;
  END LOOP;

  RAISE LOG '🎉 Total Awarded: ₹% to % winners', v_total_awarded, v_winners_count;

  RETURN jsonb_build_object(
    'success', true,
    'total_awarded', v_total_awarded,
    'winners_count', v_winners_count,
    'winners', v_result
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '❌ Error in calculate_and_award_competition_prizes: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_and_award_competition_prizes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_and_award_competition_prizes(uuid) TO service_role;

COMMENT ON FUNCTION calculate_and_award_competition_prizes IS 
'Awards competition prizes to top 3 ranks with proper tie handling. 
If multiple users are tied at the same rank, the prize is split equally among them.
Example: 4 users tied at rank 3 with ₹100 prize → each gets ₹25';
