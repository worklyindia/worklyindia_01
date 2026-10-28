-- Remove legacy sub-accounts that are fully disconnected: only connected sub-accounts are listed anywhere.
DELETE FROM public.developer_connect_sessions
WHERE sub_account_id IN (SELECT id FROM public.developer_sub_accounts WHERE status = 'disconnected');

DELETE FROM public.developer_sub_account_tokens
WHERE phone_number_id IN (
  SELECT phone_number_id FROM public.developer_sub_account_numbers
  WHERE sub_account_id IN (SELECT id FROM public.developer_sub_accounts WHERE status = 'disconnected')
);

DELETE FROM public.developer_sub_account_numbers
WHERE sub_account_id IN (SELECT id FROM public.developer_sub_accounts WHERE status = 'disconnected');

DELETE FROM public.developer_sub_accounts WHERE status = 'disconnected';