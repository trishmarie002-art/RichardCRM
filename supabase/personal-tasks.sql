create table if not exists public.personal_tasks (
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
title text not null check (length(trim(title)) between 1 and 200),
notes text not null default '',
task_date date not null,
task_time time,
completed boolean not null default false,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create index if not exists personal_tasks_owner_day_idx on public.personal_tasks(user_id,task_date);
alter table public.personal_tasks enable row level security;
revoke all on public.personal_tasks from anon,authenticated;
grant select,insert,update,delete on public.personal_tasks to authenticated;
create policy personal_tasks_select_own on public.personal_tasks for select to authenticated using ((select auth.uid())=user_id);
create policy personal_tasks_insert_own on public.personal_tasks for insert to authenticated with check ((select auth.uid())=user_id);
create policy personal_tasks_update_own on public.personal_tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy personal_tasks_delete_own on public.personal_tasks for delete to authenticated using ((select auth.uid())=user_id);
