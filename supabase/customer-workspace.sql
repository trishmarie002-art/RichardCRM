-- Customer scheduling and activity history.
create table if not exists public.customer_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('task','appointment','note')),
  title text not null check (length(trim(title)) > 0 and length(title) <= 200),
  details text not null default '',
  due_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind = 'note' or due_at is not null)
);
create index if not exists activity_user_idx on public.customer_activity(user_id);
create index if not exists activity_lead_created_idx on public.customer_activity(lead_id,created_at desc);
create index if not exists activity_due_idx on public.customer_activity(user_id,due_at) where completed = false;
alter table public.customer_activity enable row level security;
create policy activity_select_own on public.customer_activity for select to authenticated using ((select auth.uid())=user_id);
create policy activity_insert_own on public.customer_activity for insert to authenticated with check (
 (select auth.uid())=user_id and exists (select 1 from public.leads where leads.id=lead_id and leads.user_id=(select auth.uid()))
);
create policy activity_update_own on public.customer_activity for update to authenticated using ((select auth.uid())=user_id) with check (
 (select auth.uid())=user_id and exists (select 1 from public.leads where leads.id=lead_id and leads.user_id=(select auth.uid()))
);
revoke all on public.customer_activity from anon,authenticated;
grant select,insert,update on public.customer_activity to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('customer-files','customer-files',false,52428800,array['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/quicktime','video/webm','video/x-m4v'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy customer_files_select on storage.objects for select to authenticated using (
 bucket_id='customer-files' and (storage.foldername(objects.name))[1]=(select auth.uid())::text
 and exists(select 1 from public.leads where leads.id::text=(storage.foldername(objects.name))[2] and leads.user_id=(select auth.uid()))
);
create policy customer_files_insert on storage.objects for insert to authenticated with check (
 bucket_id='customer-files' and (storage.foldername(objects.name))[1]=(select auth.uid())::text
 and exists(select 1 from public.leads where leads.id::text=(storage.foldername(objects.name))[2] and leads.user_id=(select auth.uid()))
);
create policy customer_files_delete on storage.objects for delete to authenticated using (
 bucket_id='customer-files' and (storage.foldername(objects.name))[1]=(select auth.uid())::text
 and exists(select 1 from public.leads where leads.id::text=(storage.foldername(objects.name))[2] and leads.user_id=(select auth.uid()))
);
