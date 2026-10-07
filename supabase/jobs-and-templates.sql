create table public.jobs(
id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
lead_id uuid not null references public.leads(id) on delete cascade,title text not null check(length(trim(title)) between 1 and 200),
status text not null default 'Planning' check(status in ('Planning','Scheduled','In progress','Completed','Cancelled')),
scheduled_date date,crew text not null default '',materials text not null default '',notes text not null default '',
checklist jsonb not null default '{}' check(jsonb_typeof(checklist)='object'),
created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index jobs_owner_idx on public.jobs(user_id);
create index jobs_lead_idx on public.jobs(lead_id);
alter table public.jobs enable row level security;
revoke all on public.jobs from anon,authenticated;
grant select,insert,update,delete on public.jobs to authenticated;
create policy jobs_select_own on public.jobs for select to authenticated using((select auth.uid())=user_id);
create policy jobs_insert_own on public.jobs for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.leads where id=lead_id and user_id=(select auth.uid())));
create policy jobs_update_own on public.jobs for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and exists(select 1 from public.leads where id=lead_id and user_id=(select auth.uid())));
create policy jobs_delete_own on public.jobs for delete to authenticated using((select auth.uid())=user_id);
create table public.material_templates(
id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
name text not null check(length(trim(name)) between 1 and 100),
items jsonb not null check(jsonb_typeof(items)='array'),created_at timestamptz not null default now());
create index material_templates_owner_idx on public.material_templates(user_id);
alter table public.material_templates enable row level security;
revoke all on public.material_templates from anon,authenticated;
grant select,insert,delete on public.material_templates to authenticated;
create policy material_templates_select_own on public.material_templates for select to authenticated using((select auth.uid())=user_id);
create policy material_templates_insert_own on public.material_templates for insert to authenticated with check((select auth.uid())=user_id);
create policy material_templates_delete_own on public.material_templates for delete to authenticated using((select auth.uid())=user_id);
