-- =====================================================
-- MONTHLY EMPLOYER REFERRAL LEADERBOARD COMPETITION
-- =====================================================

-- 1. CREATE ENUM FOR CYCLE STATUS
CREATE TYPE referral_cycle_status AS ENUM ('active', 'completed', 'processing');

-- 2. CREATE TABLES

-- Table: referral_leaderboard_cycles
-- Stores monthly competition cycles
CREATE TABLE public.referral_leaderboard_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_start TIMESTAMP WITH TIME ZONE NOT NULL,
  cycle_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status referral_cycle_status NOT NULL DEFAULT 'active',
  winners_announced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_cycle_month UNIQUE (cycle_start)
);

-- Table: referral_leaderboard_entries
-- Tracks real-time standings during active cycle
CREATE TABLE public.referral_leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.referral_leaderboard_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_referrals_count INTEGER NOT NULL DEFAULT 0,
  last_referral_at TIMESTAMP WITH TIME ZONE,
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_cycle_user UNIQUE (cycle_id, user_id)
);

-- Table: referral_leaderboard_history
-- Permanent record of completed competitions
CREATE TABLE public.referral_leaderboard_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.referral_leaderboard_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  final_rank INTEGER NOT NULL,
  active_referrals_count INTEGER NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  reward_credited BOOLEAN NOT NULL DEFAULT false,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. ADD CYCLE_ID TO EXISTING referral_commissions TABLE
ALTER TABLE public.referral_commissions 
ADD COLUMN cycle_id UUID REFERENCES public.referral_leaderboard_cycles(id) ON DELETE SET NULL;

-- 4. CREATE INDEXES
CREATE INDEX idx_leaderboard_entries_cycle_user ON public.referral_leaderboard_entries(cycle_id, user_id);
CREATE INDEX idx_leaderboard_entries_rank ON public.referral_leaderboard_entries(cycle_id, rank);
CREATE INDEX idx_commissions_cycle_referrer ON public.referral_commissions(cycle_id, referrer_id, status);
CREATE INDEX idx_leaderboard_history_cycle ON public.referral_leaderboard_history(cycle_id);
CREATE INDEX idx_leaderboard_history_user ON public.referral_leaderboard_history(user_id);
CREATE INDEX idx_cycles_status ON public.referral_leaderboard_cycles(status);

-- 5. CREATE FUNCTIONS

-- Function: initialize_monthly_cycle
-- Creates new cycle on 1st of month (IST timezone)
CREATE OR REPLACE FUNCTION public.initialize_monthly_cycle()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_start TIMESTAMP WITH TIME ZONE;
  v_cycle_end TIMESTAMP WITH TIME ZONE;
  v_current_date DATE;
BEGIN
  -- Get current date in IST timezone
  v_current_date := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;
  
  -- Calculate cycle start (1st of current month at 00:00 IST)
  v_cycle_start := (date_trunc('month', v_current_date) AT TIME ZONE 'Asia/Kolkata');
  
  -- Calculate cycle end (last day of current month at 23:59:59 IST)
  v_cycle_end := ((date_trunc('month', v_current_date) + interval '1 month' - interval '1 second') AT TIME ZONE 'Asia/Kolkata');
  
  -- Check if cycle already exists for this month
  SELECT id INTO v_cycle_id
  FROM public.referral_leaderboard_cycles
  WHERE cycle_start = v_cycle_start;
  
  IF v_cycle_id IS NULL THEN
    -- Create new cycle
    INSERT INTO public.referral_leaderboard_cycles (cycle_start, cycle_end, status, winners_announced)
    VALUES (v_cycle_start, v_cycle_end, 'active', false)
    RETURNING id INTO v_cycle_id;
    
    RAISE NOTICE 'New cycle created: %', v_cycle_id;
  ELSE
    RAISE NOTICE 'Cycle already exists for this month: %', v_cycle_id;
  END IF;
  
  RETURN v_cycle_id;
END;
$$;

-- Function: update_leaderboard_entry
-- Updates user's standing in current cycle
CREATE OR REPLACE FUNCTION public.update_leaderboard_entry(p_user_id UUID, p_cycle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_last_referral TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count DISTINCT active users referred by this user in this cycle
  SELECT 
    COUNT(DISTINCT rc.referred_user_id),
    MAX(rc.created_at)
  INTO v_count, v_last_referral
  FROM public.referral_commissions rc
  LEFT JOIN public.profiles p ON p.user_id = rc.referred_user_id
  LEFT JOIN public.companies c ON c.user_id = rc.referred_user_id
  WHERE rc.referrer_id = p_user_id
    AND rc.cycle_id = p_cycle_id
    AND rc.status = 'completed'
    AND COALESCE(p.account_status, 'active') NOT IN ('deleted', 'banned')
    AND COALESCE(c.account_status, 'active') NOT IN ('deleted', 'banned');
  
  -- Upsert into leaderboard_entries
  INSERT INTO public.referral_leaderboard_entries (cycle_id, user_id, active_referrals_count, last_referral_at, updated_at)
  VALUES (p_cycle_id, p_user_id, v_count, v_last_referral, now())
  ON CONFLICT (cycle_id, user_id)
  DO UPDATE SET
    active_referrals_count = v_count,
    last_referral_at = v_last_referral,
    updated_at = now();
  
  -- Recalculate ranks for this cycle
  WITH ranked_entries AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY active_referrals_count DESC, last_referral_at ASC
      ) AS new_rank
    FROM public.referral_leaderboard_entries
    WHERE cycle_id = p_cycle_id
  )
  UPDATE public.referral_leaderboard_entries e
  SET rank = r.new_rank, updated_at = now()
  FROM ranked_entries r
  WHERE e.id = r.id;
END;
$$;

-- Function: finalize_monthly_cycle
-- Called at cycle end to determine winners
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
    -- Determine reward amount
    v_reward_amount := CASE v_winner.rank
      WHEN 1 THEN 200
      WHEN 2 THEN 150
      WHEN 3 THEN 100
      ELSE 0
    END;
    
    -- Insert into history
    INSERT INTO public.referral_leaderboard_history (
      cycle_id, user_id, final_rank, active_referrals_count, 
      reward_amount, reward_credited, company_name
    )
    VALUES (
      p_cycle_id, v_winner.user_id, v_winner.rank, v_winner.active_referrals_count,
      v_reward_amount, true, v_winner.company_name
    );
    
    -- Credit reward to referral_wallets
    INSERT INTO public.referral_wallets (user_id, balance_amount, total_earned, updated_at)
    VALUES (v_winner.user_id, v_reward_amount, v_reward_amount, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance_amount = referral_wallets.balance_amount + v_reward_amount,
      total_earned = referral_wallets.total_earned + v_reward_amount,
      updated_at = now();
    
    -- Create adjustment entry
    INSERT INTO public.referral_wallet_adjustments (
      user_id, amount, adjustment_type, reason, created_at
    )
    VALUES (
      v_winner.user_id, v_reward_amount, 'add',
      'Monthly Leaderboard Winner - Rank #' || v_winner.rank,
      now()
    );
    
    -- Send notification
    INSERT INTO public.employer_notifications (
      user_id, title, message, type, metadata, created_at
    )
    VALUES (
      v_winner.user_id,
      CASE v_winner.rank
        WHEN 1 THEN '🏆 Congratulations! You Won Rank #1!'
        WHEN 2 THEN '🥈 Amazing! You Won Rank #2!'
        WHEN 3 THEN '🥉 Great Job! You Won Rank #3!'
      END,
      'You are the Winner of this month''s Referral Competition! ₹' || v_reward_amount || ' has been added to your Referral Wallet.',
      'reward',
      jsonb_build_object(
        'cycle_id', p_cycle_id,
        'rank', v_winner.rank,
        'reward_amount', v_reward_amount,
        'active_referrals_count', v_winner.active_referrals_count
      ),
      now()
    );
  END LOOP;
  
  -- Update cycle status to completed
  UPDATE public.referral_leaderboard_cycles
  SET 
    status = 'completed',
    winners_announced = true,
    updated_at = now()
  WHERE id = p_cycle_id;
  
  RAISE NOTICE 'Cycle finalized: %', p_cycle_id;
END;
$$;

-- Function: get_current_leaderboard
-- Returns current cycle's Top N employers
CREATE OR REPLACE FUNCTION public.get_current_leaderboard(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  company_name TEXT,
  logo_url TEXT,
  active_referrals_count INTEGER,
  last_referral_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle_id UUID;
BEGIN
  -- Get current active cycle
  SELECT id INTO v_current_cycle_id
  FROM public.referral_leaderboard_cycles
  WHERE status = 'active'
  ORDER BY cycle_start DESC
  LIMIT 1;
  
  IF v_current_cycle_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    e.rank,
    e.user_id,
    COALESCE(c.company_name, 'Company') AS company_name,
    c.logo_url,
    e.active_referrals_count,
    e.last_referral_at
  FROM public.referral_leaderboard_entries e
  LEFT JOIN public.companies c ON c.user_id = e.user_id
  WHERE e.cycle_id = v_current_cycle_id
  ORDER BY e.rank ASC
  LIMIT p_limit;
END;
$$;

-- Function: get_user_leaderboard_position
-- Returns current user's standing
CREATE OR REPLACE FUNCTION public.get_user_leaderboard_position(p_user_id UUID)
RETURNS TABLE (
  rank INTEGER,
  active_referrals_count INTEGER,
  next_rank_gap INTEGER,
  cycle_id UUID,
  cycle_end TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle_id UUID;
  v_cycle_end TIMESTAMP WITH TIME ZONE;
  v_user_rank INTEGER;
  v_user_count INTEGER;
  v_next_rank_count INTEGER;
BEGIN
  -- Get current active cycle
  SELECT id, cycles.cycle_end INTO v_current_cycle_id, v_cycle_end
  FROM public.referral_leaderboard_cycles cycles
  WHERE status = 'active'
  ORDER BY cycle_start DESC
  LIMIT 1;
  
  IF v_current_cycle_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's entry
  SELECT e.rank, e.active_referrals_count 
  INTO v_user_rank, v_user_count
  FROM public.referral_leaderboard_entries e
  WHERE e.cycle_id = v_current_cycle_id
    AND e.user_id = p_user_id;
  
  -- Get next rank's count (for gap calculation)
  IF v_user_rank IS NOT NULL AND v_user_rank > 1 THEN
    SELECT e.active_referrals_count INTO v_next_rank_count
    FROM public.referral_leaderboard_entries e
    WHERE e.cycle_id = v_current_cycle_id
      AND e.rank = v_user_rank - 1;
  END IF;
  
  RETURN QUERY
  SELECT 
    COALESCE(v_user_rank, 0) AS rank,
    COALESCE(v_user_count, 0) AS active_referrals_count,
    COALESCE(v_next_rank_count - v_user_count, 0) AS next_rank_gap,
    v_current_cycle_id AS cycle_id,
    v_cycle_end AS cycle_end;
END;
$$;

-- Function: get_leaderboard_history
-- Returns past competitions
CREATE OR REPLACE FUNCTION public.get_leaderboard_history(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  cycle_id UUID,
  cycle_start TIMESTAMP WITH TIME ZONE,
  cycle_end TIMESTAMP WITH TIME ZONE,
  user_id UUID,
  company_name TEXT,
  final_rank INTEGER,
  active_referrals_count INTEGER,
  reward_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NOT NULL THEN
    -- Return user's history
    RETURN QUERY
    SELECT 
      c.id AS cycle_id,
      c.cycle_start,
      c.cycle_end,
      h.user_id,
      h.company_name,
      h.final_rank,
      h.active_referrals_count,
      h.reward_amount,
      h.created_at
    FROM public.referral_leaderboard_history h
    JOIN public.referral_leaderboard_cycles c ON c.id = h.cycle_id
    WHERE h.user_id = p_user_id
    ORDER BY c.cycle_start DESC;
  ELSE
    -- Return all winners
    RETURN QUERY
    SELECT 
      c.id AS cycle_id,
      c.cycle_start,
      c.cycle_end,
      h.user_id,
      h.company_name,
      h.final_rank,
      h.active_referrals_count,
      h.reward_amount,
      h.created_at
    FROM public.referral_leaderboard_history h
    JOIN public.referral_leaderboard_cycles c ON c.id = h.cycle_id
    ORDER BY c.cycle_start DESC, h.final_rank ASC;
  END IF;
END;
$$;

-- 6. CREATE TRIGGERS

-- Trigger: Update leaderboard when commission is completed
CREATE OR REPLACE FUNCTION public.on_commission_completed_update_leaderboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle_id UUID;
BEGIN
  -- Only process if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get current active cycle
    SELECT id INTO v_current_cycle_id
    FROM public.referral_leaderboard_cycles
    WHERE status = 'active'
    ORDER BY cycle_start DESC
    LIMIT 1;
    
    IF v_current_cycle_id IS NOT NULL THEN
      -- Update commission's cycle_id if not set
      IF NEW.cycle_id IS NULL THEN
        NEW.cycle_id := v_current_cycle_id;
      END IF;
      
      -- Update leaderboard entry for the referrer
      PERFORM public.update_leaderboard_entry(NEW.referrer_id, v_current_cycle_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_commission_completed_leaderboard
BEFORE UPDATE ON public.referral_commissions
FOR EACH ROW
EXECUTE FUNCTION public.on_commission_completed_update_leaderboard();

-- Trigger: Recalculate leaderboard when user account status changes
CREATE OR REPLACE FUNCTION public.on_user_status_change_update_leaderboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle_id UUID;
  v_referrer_id UUID;
BEGIN
  -- Only process if account_status changed to deleted or banned
  IF NEW.account_status IN ('deleted', 'banned') AND 
     (OLD.account_status IS NULL OR OLD.account_status NOT IN ('deleted', 'banned')) THEN
    
    -- Get current active cycle
    SELECT id INTO v_current_cycle_id
    FROM public.referral_leaderboard_cycles
    WHERE status = 'active'
    ORDER BY cycle_start DESC
    LIMIT 1;
    
    IF v_current_cycle_id IS NOT NULL THEN
      -- Find all referrers who referred this user
      FOR v_referrer_id IN
        SELECT DISTINCT referrer_id
        FROM public.referral_commissions
        WHERE referred_user_id = NEW.user_id
          AND cycle_id = v_current_cycle_id
      LOOP
        -- Update each referrer's leaderboard entry
        PERFORM public.update_leaderboard_entry(v_referrer_id, v_current_cycle_id);
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_profile_status_change_leaderboard
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.on_user_status_change_update_leaderboard();

CREATE TRIGGER trigger_company_status_change_leaderboard
AFTER UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.on_user_status_change_update_leaderboard();

-- 7. ENABLE ROW LEVEL SECURITY

ALTER TABLE public.referral_leaderboard_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_leaderboard_history ENABLE ROW LEVEL SECURITY;

-- 8. CREATE RLS POLICIES

-- Policies for referral_leaderboard_cycles
CREATE POLICY "Anyone can view cycles"
ON public.referral_leaderboard_cycles
FOR SELECT
USING (true);

CREATE POLICY "Only system can manage cycles"
ON public.referral_leaderboard_cycles
FOR ALL
USING (false)
WITH CHECK (false);

-- Policies for referral_leaderboard_entries
CREATE POLICY "Anyone can view leaderboard entries"
ON public.referral_leaderboard_entries
FOR SELECT
USING (true);

CREATE POLICY "Only system can manage entries"
ON public.referral_leaderboard_entries
FOR ALL
USING (false)
WITH CHECK (false);

-- Policies for referral_leaderboard_history
CREATE POLICY "Anyone can view leaderboard history"
ON public.referral_leaderboard_history
FOR SELECT
USING (true);

CREATE POLICY "Only system can manage history"
ON public.referral_leaderboard_history
FOR ALL
USING (false)
WITH CHECK (false);

-- 9. INITIALIZE FIRST CYCLE
SELECT public.initialize_monthly_cycle();