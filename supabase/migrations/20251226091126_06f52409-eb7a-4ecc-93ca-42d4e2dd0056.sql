-- Fix event name consistency: Update trigger_event values to match UI expectations

-- Update Low Balance Alert: push_low_balance → push_employer_low_balance
UPDATE public.onesignal_automation_rules 
SET trigger_event = 'push_employer_low_balance',
    updated_at = now()
WHERE trigger_event = 'push_low_balance';

-- Update Inactive Employer: push_inactive_employer → push_employer_inactive
UPDATE public.onesignal_automation_rules 
SET trigger_event = 'push_employer_inactive',
    updated_at = now()
WHERE trigger_event = 'push_inactive_employer';