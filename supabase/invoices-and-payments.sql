create table public.invoices(
id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
job_id uuid not null unique references public.jobs(id) on delete restrict,
number text not null check(length(trim(number)) between 1 and 60),
total_cents integer not null check(total_cents between 1 and 100000000),
deposit_cents integer not null default 0 check(deposit_cents>=0 and deposit_cents<=total_cents),
due_date date,notes text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
unique(user_id,number));
alter table public.invoices enable row level security;
revoke all on public.invoices from anon,authenticated;
grant select,insert,update on public.invoices to authenticated;
create policy invoices_select_own on public.invoices for select to authenticated using((select auth.uid())=user_id);
create policy invoices_insert_own on public.invoices for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.jobs where id=job_id and user_id=(select auth.uid())));
create policy invoices_update_own on public.invoices for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and exists(select 1 from public.jobs where id=job_id and user_id=(select auth.uid())));
create table public.invoice_payments(
id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
invoice_id uuid not null references public.invoices(id) on delete restrict,
amount_cents integer not null check(amount_cents between 1 and 100000000),paid_date date not null,
method text not null check(method in ('Cash','Check','Bank transfer','Card','Other')),
purpose text not null check(purpose in ('Payment','Deposit')),reference text not null default '',created_at timestamptz not null default now());
create index invoice_payments_owner_idx on public.invoice_payments(user_id);
create index invoice_payments_invoice_idx on public.invoice_payments(invoice_id);
alter table public.invoice_payments enable row level security;
revoke all on public.invoice_payments from anon,authenticated;
grant select,insert,delete on public.invoice_payments to authenticated;
create policy invoice_payments_select_own on public.invoice_payments for select to authenticated using((select auth.uid())=user_id);
create policy invoice_payments_insert_own on public.invoice_payments for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.invoices where id=invoice_id and user_id=(select auth.uid())));
create policy invoice_payments_delete_own on public.invoice_payments for delete to authenticated using((select auth.uid())=user_id);
