REVOKE EXECUTE ON FUNCTION public.send_referral_push(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_referral_wallet_credit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_referral_withdrawal_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_referral_join() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_referral_competition_win() FROM PUBLIC, anon, authenticated;