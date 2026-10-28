-- Backfill missing points_transactions entries for existing interviews with proper balance calculation
DO $$
DECLARE
  interview_record RECORD;
  current_balance integer;
BEGIN
  -- Process each interview that needs a transaction entry
  FOR interview_record IN
    SELECT DISTINCT
      c.user_id,
      i.id as interview_id,
      i.job_id,
      i.points_spent,
      i.created_at,
      i.scheduled_at,
      i.mode,
      (SELECT COUNT(*) 
       FROM interviews i2 
       WHERE i2.job_id = i.job_id 
       AND i2.created_at = i.created_at
       AND i2.payment_status = 'completed') as candidate_count
    FROM interviews i
    JOIN jobs j ON j.id = i.job_id
    JOIN companies c ON c.id = j.company_id
    WHERE i.points_spent > 0
      AND i.payment_status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM points_transactions pt
        WHERE pt.user_id = c.user_id
        AND pt.metadata->>'interview_id' = i.id::text
      )
    ORDER BY i.created_at ASC
  LOOP
    -- Get current wallet balance at the time (or use current balance as approximation)
    SELECT COALESCE(balance_points, 0) INTO current_balance
    FROM wallets
    WHERE user_id = interview_record.user_id;
    
    -- Insert the transaction with calculated balance
    INSERT INTO points_transactions (
      user_id,
      points_amount,
      points_balance_after,
      transaction_type,
      description,
      created_at,
      metadata
    ) VALUES (
      interview_record.user_id,
      -interview_record.points_spent,
      current_balance, -- Using current balance as approximation
      'spend',
      '🎤 Interview Scheduled - ' || interview_record.candidate_count::text || ' Candidate(s)',
      interview_record.created_at,
      jsonb_build_object(
        'payment_method', 'wallet',
        'status', 'completed',
        'interview_id', interview_record.interview_id,
        'job_id', interview_record.job_id,
        'points_per_interview', interview_record.points_spent,
        'scheduled_at', interview_record.scheduled_at,
        'mode', interview_record.mode,
        'backfilled', true
      )
    );
  END LOOP;
  
  RAISE NOTICE 'Successfully backfilled interview payment entries';
END $$;