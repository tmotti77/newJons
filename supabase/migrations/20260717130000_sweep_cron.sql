-- Safety net (§3.4c) + retention: call api/sweep-rounds every minute via
-- pg_cron + pg_net. The anon key is publishable by design; the endpoint is
-- idempotent and only resolves already-expired rounds.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'sweep-rounds-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://viwjknigxfxwszfvxsrg.supabase.co/functions/v1/api/sweep-rounds',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <PROJECT_ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
