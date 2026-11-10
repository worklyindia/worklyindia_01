UPDATE public.whatsapp_audience_accounts AS account
SET status = 'disconnected',
    updated_at = now()
WHERE account.status = 'connected'
  AND account.audience <> 'customer_service'
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_audience_accounts AS customer_service
    WHERE customer_service.audience = 'customer_service'
      AND customer_service.status = 'connected'
      AND customer_service.phone_number_id IS NOT NULL
      AND customer_service.phone_number_id = account.phone_number_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_audience_accounts_connected_phone_unique
ON public.whatsapp_audience_accounts (phone_number_id)
WHERE status = 'connected' AND phone_number_id IS NOT NULL;