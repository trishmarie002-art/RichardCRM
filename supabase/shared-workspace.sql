-- Approved Star Roofing CRM logins share business records; personal_tasks stays owner-only.
create schema if not exists private;
create table if not exists private.crm_members (user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.crm_members enable row level security;
revoke all on private.crm_members from public, anon, authenticated;
insert into private.crm_members(user_id)
select id from auth.users where lower(email) in ('hernz210digital@gmail.com','hernzwebdesign@gmail.com','starroofingcrm@gmail.com')
on conflict do nothing;
do $$ begin
 if (select count(*) from private.crm_members) <> 3 then raise exception 'Expected exactly three approved CRM members'; end if;
end $$;
create or replace function private.crm_access(record_owner uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
 select auth.uid() is not null
 and exists(select 1 from private.crm_members where user_id=auth.uid())
 and exists(select 1 from private.crm_members where user_id=record_owner);
$$;
revoke all on function private.crm_access(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.crm_access(uuid) to authenticated;
do $$ declare p record; begin
for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('leads','roof_measurements','estimates','customer_activity','jobs','material_templates','invoices','invoice_payments','crm_records','customer_locations') loop
execute format('drop policy %I on public.%I',p.policyname,p.tablename);
end loop; end $$;
create policy leads_shared_select on public.leads for select to authenticated using (private.crm_access(user_id));
create policy leads_shared_insert on public.leads for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id));
create policy leads_shared_update on public.leads for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id));
create policy leads_shared_delete on public.leads for delete to authenticated using (private.crm_access(user_id));
create policy roof_measurements_shared_select on public.roof_measurements for select to authenticated using (private.crm_access(user_id));
create policy roof_measurements_shared_insert on public.roof_measurements for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and ((roof_measurements.lead_id is null or exists(select 1 from public.leads p where p.id=roof_measurements.lead_id))));
create policy roof_measurements_shared_update on public.roof_measurements for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id) and ((roof_measurements.lead_id is null or exists(select 1 from public.leads p where p.id=roof_measurements.lead_id))));
create policy roof_measurements_shared_delete on public.roof_measurements for delete to authenticated using (private.crm_access(user_id));
create policy estimates_shared_select on public.estimates for select to authenticated using (private.crm_access(user_id));
create policy estimates_shared_insert on public.estimates for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=estimates.lead_id)));
create policy estimates_shared_update on public.estimates for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=estimates.lead_id)));
create policy customer_activity_shared_select on public.customer_activity for select to authenticated using (private.crm_access(user_id));
create policy customer_activity_shared_insert on public.customer_activity for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=customer_activity.lead_id)));
create policy customer_activity_shared_update on public.customer_activity for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=customer_activity.lead_id)));
create policy jobs_shared_select on public.jobs for select to authenticated using (private.crm_access(user_id));
create policy jobs_shared_insert on public.jobs for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=jobs.lead_id)));
create policy jobs_shared_update on public.jobs for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=jobs.lead_id)));
create policy jobs_shared_delete on public.jobs for delete to authenticated using (private.crm_access(user_id));
create policy material_templates_shared_select on public.material_templates for select to authenticated using (private.crm_access(user_id));
create policy material_templates_shared_insert on public.material_templates for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id));
create policy material_templates_shared_delete on public.material_templates for delete to authenticated using (private.crm_access(user_id));
create policy invoices_shared_select on public.invoices for select to authenticated using (private.crm_access(user_id));
create policy invoices_shared_insert on public.invoices for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and (exists(select 1 from public.jobs p where p.id=invoices.job_id)));
create policy invoices_shared_update on public.invoices for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id) and (exists(select 1 from public.jobs p where p.id=invoices.job_id)));
create policy invoice_payments_shared_select on public.invoice_payments for select to authenticated using (private.crm_access(user_id));
create policy invoice_payments_shared_insert on public.invoice_payments for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and (exists(select 1 from public.invoices p where p.id=invoice_payments.invoice_id)));
create policy invoice_payments_shared_delete on public.invoice_payments for delete to authenticated using (private.crm_access(user_id));
create policy crm_records_shared_select on public.crm_records for select to authenticated using (private.crm_access(user_id));
create policy crm_records_shared_insert on public.crm_records for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=crm_records.lead_id)));
create policy crm_records_shared_update on public.crm_records for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=crm_records.lead_id)));
create policy crm_records_shared_delete on public.crm_records for delete to authenticated using (private.crm_access(user_id));
create policy customer_locations_shared_select on public.customer_locations for select to authenticated using (private.crm_access(user_id));
create policy customer_locations_shared_insert on public.customer_locations for insert to authenticated with check ((select auth.uid())=user_id and private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=customer_locations.lead_id)));
create policy customer_locations_shared_update on public.customer_locations for update to authenticated using (private.crm_access(user_id)) with check (private.crm_access(user_id) and (exists(select 1 from public.leads p where p.id=customer_locations.lead_id)));
create policy customer_locations_shared_delete on public.customer_locations for delete to authenticated using (private.crm_access(user_id));
drop policy customer_files_select on storage.objects;
create policy customer_files_select on storage.objects for select to authenticated using (bucket_id='customer-files' and exists(select 1 from public.leads l where l.id::text=(storage.foldername(objects.name))[2] and l.user_id::text=(storage.foldername(objects.name))[1] and private.crm_access(l.user_id)));
drop policy customer_files_insert on storage.objects;
create policy customer_files_insert on storage.objects for insert to authenticated with check (bucket_id='customer-files' and exists(select 1 from public.leads l where l.id::text=(storage.foldername(objects.name))[2] and l.user_id::text=(storage.foldername(objects.name))[1] and private.crm_access(l.user_id)));
drop policy customer_files_delete on storage.objects;
create policy customer_files_delete on storage.objects for delete to authenticated using (bucket_id='customer-files' and exists(select 1 from public.leads l where l.id::text=(storage.foldername(objects.name))[2] and l.user_id::text=(storage.foldername(objects.name))[1] and private.crm_access(l.user_id)));

