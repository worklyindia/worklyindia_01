ALTER TABLE public.device_info_logs
  ADD COLUMN IF NOT EXISTS native_device_info jsonb;

COMMENT ON COLUMN public.device_info_logs.native_device_info IS
  'Consent-based, non-sensitive Android app diagnostics (manufacturer/model, OS/API, app version, install-scoped random ID, display/network/battery status). Never store hardware serials or IMEI.';