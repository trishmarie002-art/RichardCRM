create table public.crm_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 lead_id uuid not null references public.leads(id) on delete cascade,
 kind text not null check(kind in ('inspection','profit','options','warranty','location','message')),
 title text not null check(length(trim(title)) between 1 and 200),
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index crm_records_owner_kind on public.crm_records(user_id,kind);
create index crm_records_lead on public.crm_records(lead_id);
alter table public.crm_records enable row level security;
revoke all on public.crm_records from anon,authenticated;
grant select,insert,update,delete on public.crm_records to authenticated;
create policy crm_records_select on public.crm_records for select to authenticated using((select auth.uid())=user_id);
create policy crm_records_insert on public.crm_records for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.leads l where l.id=crm_records.lead_id and l.user_id=(select auth.uid())));
create policy crm_records_update on public.crm_records for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and exists(select 1 from public.leads l where l.id=crm_records.lead_id and l.user_id=(select auth.uid())));
create policy crm_records_delete on public.crm_records for delete to authenticated using((select auth.uid())=user_id);

alter table public.jobs add column progress_stage text not null default 'Planning' check(progress_stage in ('Planning','Materials Ordered','Delivery Scheduled','Installation','Cleanup','Final Inspection','Completed'));
