-- Richard Roof CRM production schema
-- Run this in the dedicated RichardCRM Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  status text not null default 'New Lead'
    check (status in ('New Lead','Inspection','Estimate Sent','Won','Lost')),
  source text not null default 'Other',
  potential_value numeric(12,2) not null default 0 check (potential_value >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_id_idx on public.leads(user_id);
create index if not exists leads_user_status_idx on public.leads(user_id, status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);

alter table public.leads enable row level security;

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own"
on public.leads for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own"
on public.leads for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own"
on public.leads for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own"
on public.leads for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.roof_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  property_address text not null default '',
  waste_percent numeric(5,2) not null default 10 check (waste_percent >= 0 and waste_percent <= 50),
  footprint_sqft numeric(12,2) not null default 0 check (footprint_sqft >= 0),
  roof_surface_sqft numeric(12,2) not null default 0 check (roof_surface_sqft >= 0),
  roofing_squares numeric(12,2) not null default 0 check (roofing_squares >= 0),
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists roof_measurements_user_id_idx on public.roof_measurements(user_id);
create index if not exists roof_measurements_lead_id_idx on public.roof_measurements(lead_id);

alter table public.roof_measurements enable row level security;

drop policy if exists "roof_measurements_select_own" on public.roof_measurements;
create policy "roof_measurements_select_own"
on public.roof_measurements for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "roof_measurements_insert_own" on public.roof_measurements;
create policy "roof_measurements_insert_own"
on public.roof_measurements for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (lead_id is null or exists (
    select 1 from public.leads where leads.id = lead_id and leads.user_id = (select auth.uid())
  ))
);

drop policy if exists "roof_measurements_update_own" on public.roof_measurements;
create policy "roof_measurements_update_own"
on public.roof_measurements for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (lead_id is null or exists (
    select 1 from public.leads where leads.id = lead_id and leads.user_id = (select auth.uid())
  ))
);

drop policy if exists "roof_measurements_delete_own" on public.roof_measurements;
create policy "roof_measurements_delete_own"
on public.roof_measurements for delete
to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.roof_measurements to authenticated;

