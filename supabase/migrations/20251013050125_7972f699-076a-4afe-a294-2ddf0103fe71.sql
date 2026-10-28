-- Create table for configurable competition prizes
CREATE TABLE public.referral_competition_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank INTEGER NOT NULL UNIQUE CHECK (rank BETWEEN 1 AND 3),
  prize_amount NUMERIC NOT NULL CHECK (prize_amount > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default prize values
INSERT INTO public.referral_competition_prizes (rank, prize_amount) VALUES
  (1, 200),
  (2, 150),
  (3, 100);

-- Enable RLS
ALTER TABLE public.referral_competition_prizes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active prizes
CREATE POLICY "Anyone can view active prizes"
  ON public.referral_competition_prizes FOR SELECT
  USING (is_active = true);

-- Policy: Only admins can manage prizes
CREATE POLICY "Only admins can manage prizes"
  ON public.referral_competition_prizes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_referral_competition_prizes_updated_at
  BEFORE UPDATE ON public.referral_competition_prizes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update finalize_monthly_cycle function to use dynamic prizes
CREATE OR REPLACE FUNCTION public.finalize_monthly_cycle(p_cycle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner RECORD;
  v_reward_amount NUMERIC;
BEGIN
  -- Update cycle status to processing
  UPDATE public.referral_leaderboard_cycles
  SET status = 'processing', updated_at = now()
  WHERE id = p_cycle_id;
  
  -- Process Top 3 winners
  FOR v_winner IN
    SELECT 
      e.user_id,
      e.rank,
      e.active_referrals_count,
      COALESCE(c.company_name, 'Company') AS company_name
    FROM public.referral_leaderboard_entries e
    LEFT JOIN public.companies c ON c.user_id = e.user_id
    WHERE e.cycle_id = p_cycle_id
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
    
    -- Credit referral wallet
    INSERT INTO public.referral_wallets (user_id, balance_amount, total_earned, updated_at)
    VALUES (v_winner.user_id, v_reward_amount, v_reward_amount, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance_amount = referral_wallets.balance_amount + v_reward_amount,
      total_earned = referral_wallets.total_earned + v_reward_amount,
      updated_at = now();
    
    -- Record adjustment
    INSERT INTO public.referral_balance_adjustments (
      user_id,
      amount,
      adjustment_type,
      reason,
      created_at
    ) VALUES (
      v_winner.user_id,
      v_reward_amount,
      'prize',
      'Monthly competition prize - Rank ' || v_winner.rank,
      now()
    );
    
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
      'prize',
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
END;
$$;