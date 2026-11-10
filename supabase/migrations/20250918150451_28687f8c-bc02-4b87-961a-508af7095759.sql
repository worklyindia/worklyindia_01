-- Enable pg_net extension for HTTP requests from Postgres (used by triggers to call edge functions)
-- Safe to run multiple times
CREATE SCHEMA IF NOT EXISTS net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;
