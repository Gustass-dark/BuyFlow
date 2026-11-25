begin;
create table if not exists public.buyflow_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  plan jsonb not null check (jsonb_typeof(plan) = 'object')
);
alter table public.buyflow_plans enable row level security;
revoke all on public.buyflow_plans from public, anon, authenticated;
grant select, insert, update on public.buyflow_plans to authenticated;
drop policy if exists buyflow_read on public.buyflow_plans;
create policy buyflow_read on public.buyflow_plans for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists buyflow_insert on public.buyflow_plans;
create policy buyflow_insert on public.buyflow_plans for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists buyflow_update on public.buyflow_plans;
create policy buyflow_update on public.buyflow_plans for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
commit;
