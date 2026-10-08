create table public.customer_locations (
 lead_id uuid primary key references public.leads(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 source_address text not null, matched_address text not null default '',
 lat double precision, lng double precision,
 status text not null check(status in ('matched','not_found','ambiguous')),
 checked_at timestamptz not null default now(),
 check((status='matched' and lat between -90 and 90 and lng between -180 and 180 and lat is not null and lng is not null) or (status<>'matched' and lat is null and lng is null))
);
create index customer_locations_user on public.customer_locations(user_id);
alter table public.customer_locations enable row level security;
revoke all on public.customer_locations from anon,authenticated;
grant select,insert,update,delete on public.customer_locations to authenticated;
create policy locations_select_own on public.customer_locations for select to authenticated using((select auth.uid())=user_id);
create policy locations_insert_own on public.customer_locations for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.leads l where l.id=customer_locations.lead_id and l.user_id=(select auth.uid())));
create policy locations_update_own on public.customer_locations for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and exists(select 1 from public.leads l where l.id=customer_locations.lead_id and l.user_id=(select auth.uid())));
create policy locations_delete_own on public.customer_locations for delete to authenticated using((select auth.uid())=user_id);
