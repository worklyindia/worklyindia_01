-- Force PostgREST schema cache reload (fixes "column does not exist" errors after schema changes)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END $$;