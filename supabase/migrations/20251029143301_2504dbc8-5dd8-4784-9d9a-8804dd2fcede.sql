-- Create competition prize payments tracking table
CREATE TABLE IF NOT EXISTS public.competition_prize_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rank INTEGER NOT NULL CHECK (rank IN (1, 2, 3)),
  prize_amount NUMERIC NOT NULL CHECK (prize_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  credited_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(cycle_id, user_id)
);

-- Enable RLS
ALTER TABLE public.competition_prize_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own prize payments"
  ON public.competition_prize_payments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage prize payments"
  ON public.competition_prize_payments
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create indexes
CREATE INDEX idx_competition_prizes_cycle ON public.competition_prize_payments(cycle_id);
CREATE INDEX idx_competition_prizes_user ON public.competition_prize_payments(user_id);
CREATE INDEX idx_competition_prizes_status ON public.competition_prize_payments(status);
CREATE INDEX idx_competition_prizes_created ON public.competition_prize_payments(created_at DESC);

-- Function to calculate and award competition prizes
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
  -- Get top 3 winners from leaderboard for this cycle
  FOR v_winner IN
    SELECT 
      user_id,
      referrals_count,
      ROW_NUMBER() OVER (ORDER BY referrals_count DESC, created_at ASC) as rank
    FROM public.referral_leaderboard_entries
    WHERE cycle_id = p_cycle_id
    ORDER BY referrals_count DESC, created_at ASC
    LIMIT 3
  LOOP
    v_rank := v_winner.rank::INTEGER;
    
    -- Get prize amount for this rank
    SELECT prize_amount INTO v_prize_amount
    FROM public.referral_competition_prizes
    WHERE rank = v_rank
    LIMIT 1;
    
    -- Skip if no prize defined for this rank
    CONTINUE WHEN v_prize_amount IS NULL;
    
    -- Check if prize already awarded
    IF EXISTS (
      SELECT 1 FROM public.competition_prize_payments
      WHERE cycle_id = p_cycle_id AND user_id = v_winner.user_id
    ) THEN
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
          'referrals_count', v_winner.referrals_count
        ),
        now()
      );
      
      -- Update prize payment status
      UPDATE public.competition_prize_payments
      SET 
        status = 'credited',
        credited_at = now()
      WHERE cycle_id = p_cycle_id AND user_id = v_winner.user_id;
      
      -- Add to results
      v_results := v_results || jsonb_build_object(
        'user_id', v_winner.user_id,
        'rank', v_rank,
        'prize_amount', v_prize_amount,
        'referrals_count', v_winner.referrals_count,
        'status', 'success'
      );
      
    EXCEPTION WHEN OTHERS THEN
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
  
  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', p_cycle_id,
    'prizes_awarded', v_results
  );
END;
$$;