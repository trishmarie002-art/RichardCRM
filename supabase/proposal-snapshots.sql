alter table public.estimates add column if not exists proposal jsonb check (proposal is null or jsonb_typeof(proposal)='object');
